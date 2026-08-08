const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const pdfParse = require('pdf-parse');
const crypto = require('crypto');
const supabase = require('../supabaseClient');
const { fastExtractJson, embedText } = require('../llmRouter');

const MAX_PDF_SIZE_MB = 10;
const JACCARD_THRESHOLD = 0.85; // notes with >85% word overlap are considered duplicates

/**
 * Computes Jaccard similarity between two strings based on their word sets.
 * Returns a value between 0 (completely different) and 1 (identical).
 */
function jaccardSimilarity(a, b) {
  const tokenize = str => new Set(str.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(Boolean));
  const setA = tokenize(a);
  const setB = tokenize(b);
  if (setA.size === 0 && setB.size === 0) return 1;
  const intersection = new Set([...setA].filter(w => setB.has(w)));
  const union = new Set([...setA, ...setB]);
  return intersection.size / union.size;
}

async function extractSubjectFromText(text) {
  const prompt = `Analyze the following text.
1. Determine the most likely academic subject (e.g., Mathematics, Physics, History).
2. Determine if this text is a university exam question paper / past year paper (PYQ). Question papers usually have marks, instructions like "Answer any ten", module names, and numbered questions.

Return only a JSON object in this format: {"subject": "Subject Name", "is_pyq": true, "year": "2023 or unknown"}

Text snippet:
${text.substring(0, 1000)}...`;

  try {
    const result = await fastExtractJson(prompt);
    return {
      subject: result.subject || 'General',
      is_pyq: !!result.is_pyq,
      year: result.year || 'unknown'
    };
  } catch (error) {
    console.error('[noteHandler] Failed to extract subject:', error);
    return { subject: 'General', is_pyq: false, year: 'unknown' };
  }
}

async function handleNote(msg, text, chatId, sock) {
  let contentToSave = text;
  let subject = 'General';
  let isPyq = false;
  let year = 'unknown';

  try {
    const docMessage = msg.message?.documentMessage;
    const imgMessage = msg.message?.imageMessage;

    if (docMessage) {
      if (docMessage.mimetype === 'application/pdf') {
        if (docMessage.fileLength > MAX_PDF_SIZE_MB * 1024 * 1024) {
          console.log(`[noteHandler] Skipping PDF > ${MAX_PDF_SIZE_MB}MB`);
          return;
        }

        // Efficiently download and parse PDF
        const stream = await downloadContentFromMessage(docMessage, 'document');
        const chunks = [];
        for await (const chunk of stream) {
          chunks.push(chunk);
        }
        const buffer = Buffer.concat(chunks);

        try {
          const pdfData = await pdfParse(buffer);
          contentToSave = pdfData.text.trim() || '[Empty PDF]';
        } catch (parseErr) {
          console.error('[noteHandler] Failed to parse PDF:', parseErr);
          contentToSave = '[Unparseable PDF]';
        }
      } else {
        contentToSave = docMessage.caption || docMessage.fileName || '[Non-PDF Document]';
      }
    } else if (imgMessage) {
      contentToSave = imgMessage.caption || '[photo note - OCR pending]';
    }

    // --- Deduplication: skip if identical content was already saved for this chat ---
    const contentHash = crypto.createHash('sha256').update(contentToSave.trim()).digest('hex');
    const { data: existing } = await supabase
      .from('notes')
      .select('id')
      .eq('chat_id', chatId)
      .eq('content_hash', contentHash)
      .limit(1);

    if (existing && existing.length > 0) {
      console.log('[noteHandler] Duplicate note detected (exact match) — skipping save.');
      return;
    }

    // --- Fuzzy deduplication: skip if a very similar note already exists (Jaccard similarity) ---
    const { data: recentNotes } = await supabase
      .from('notes')
      .select('content')
      .eq('chat_id', chatId)
      .order('created_at', { ascending: false })
      .limit(20);

    if (recentNotes) {
      for (const note of recentNotes) {
        const score = jaccardSimilarity(contentToSave, note.content);
        if (score >= JACCARD_THRESHOLD) {
          console.log(`[noteHandler] Near-duplicate note detected (Jaccard: ${score.toFixed(2)}) — skipping save.`);
          return;
        }
      }
    }

    if (contentToSave.length > 20) {
       const info = await extractSubjectFromText(contentToSave);
       subject = info.subject;
       isPyq = info.is_pyq;
       year = info.year;
    }

    if (isPyq) {
      console.log(`[noteHandler] Auto-detected PYQ for ${subject}! Handing off to pyqHandler...`);
      await sock.sendMessage(chatId, { text: `🤖 *Class Copilot AI*\n\nI auto-detected that this document is actually a Past Year Question paper for *${subject}*!\nMoving it to the PYQ Predictor...` }, { quoted: msg });
      
      const { processPyqText } = require('./pyqHandler');
      await processPyqText(sock, chatId, subject, year, contentToSave);
      return;
    }

    // Embed the note for vector search (null if unavailable)
    const embedding = await embedText(`${subject}\n${contentToSave}`);

    // Save to Supabase
    const { data, error } = await supabase
      .from('notes')
      .insert([
        { chat_id: chatId, subject: subject, content: contentToSave, content_hash: contentHash, embedding: embedding }
      ]);

    if (error) {
      console.error('[noteHandler] Supabase insert error:', error);
    } else {
      console.log(`[noteHandler] Saved note for subject: ${subject}`);
    }

  } catch (error) {
    console.error('[noteHandler] Error handling note:', error);
  }
}

module.exports = { handleNote };
