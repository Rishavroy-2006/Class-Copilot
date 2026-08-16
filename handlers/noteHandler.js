const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const pdfParse = require('pdf-parse');
const xlsx = require('xlsx');
const crypto = require('crypto');
const supabase = require('../supabaseClient');
const { fastExtractJson, embedText } = require('../llmRouter');

const MAX_PDF_SIZE_MB = 10;
const JACCARD_THRESHOLD = 0.85; // notes with >85% word overlap are considered duplicates

async function customPageRender(pageData) {
  const render_options = {
    normalizeWhitespace: false,
    disableCombineTextItems: false
  };
  const textContent = await pageData.getTextContent(render_options);
  let lastY, text = '';
  for (const item of textContent.items) {
    if (lastY == item.transform[5] || !lastY) {
      text += item.str + ' ';
    } else {
      text += '\n' + item.str + ' ';
    }
    lastY = item.transform[5];
  }
  return text;
}

function tokenizeText(str) {
  return new Set(str.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(Boolean));
}

function jaccardSimilaritySets(setA, setB) {
  if (setA.size === 0 && setB.size === 0) return 1;
  const intersection = new Set([...setA].filter(w => setB.has(w)));
  const union = new Set([...setA, ...setB]);
  return intersection.size / union.size;
}

async function extractSubjectFromText(text, filename = '') {
  const fileContext = filename ? `Filename: ${filename}\\n` : '';
  const prompt = `Analyze the following text.
1. Determine the specific academic course or subject name (e.g., Data Structures, Operating Systems, Cryptography). Do not use broad category names like "Computer Science" if a specific course name is present.
2. If the text appears to be a list of names, volunteers, or administrative data without a clear academic subject, categorize it based on the filename or label it "General List".
3. Determine if this text is a university exam question paper / past year paper (PYQ). Question papers usually have marks, instructions like "Answer any ten", module names, and numbered questions.

Return only a JSON object in this format: {"subject": "Subject Name", "is_pyq": true, "year": "2023 or unknown"}

Text snippet:
${fileContext}${text.substring(0, 1500)}...`;

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
      const isSpreadsheet = docMessage.mimetype?.includes('spreadsheetml') || docMessage.mimetype?.includes('ms-excel') || docMessage.mimetype?.includes('csv') || docMessage.fileName?.endsWith('.xlsx') || docMessage.fileName?.endsWith('.xls') || docMessage.fileName?.endsWith('.csv');

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
          const pdfData = await pdfParse(buffer, { pagerender: customPageRender });
          const cleanText = pdfData.text.replace(/\S{50,}/g, '');
          contentToSave = `[Document: ${docMessage.fileName || 'Untitled PDF'}]\n` + (cleanText.trim() || '[Empty PDF]');
        } catch (parseErr) {
          console.error('[noteHandler] Failed to parse PDF:', parseErr);
          contentToSave = '[Unparseable PDF]';
        }
      } else if (isSpreadsheet) {
        if (docMessage.fileLength > MAX_PDF_SIZE_MB * 1024 * 1024) {
          console.log(`[noteHandler] Skipping Spreadsheet > ${MAX_PDF_SIZE_MB}MB`);
          return;
        }

        const stream = await downloadContentFromMessage(docMessage, 'document');
        const chunks = [];
        for await (const chunk of stream) {
          chunks.push(chunk);
        }
        const buffer = Buffer.concat(chunks);

        try {
          const workbook = xlsx.read(buffer, { type: 'buffer' });
          let textParts = [];
          
          for (const sheetName of workbook.SheetNames) {
            const sheet = workbook.Sheets[sheetName];
            const csvText = xlsx.utils.sheet_to_csv(sheet);
            if (csvText.trim()) {
              textParts.push(`--- Sheet: ${sheetName} ---\\n${csvText.trim()}`);
            }
          }
          contentToSave = `[Document: ${docMessage.fileName || 'Untitled Spreadsheet'}]\\n` + (textParts.join('\\n\\n') || '[Empty Spreadsheet]');
        } catch (parseErr) {
          console.error('[noteHandler] Failed to parse Spreadsheet:', parseErr);
          contentToSave = '[Unparseable Spreadsheet]';
        }
      } else {
        contentToSave = docMessage.caption || docMessage.fileName || '[Non-PDF Document]';
      }
    } else if (imgMessage) {
        if (!imgMessage.caption) {
          console.log('[noteHandler] Skipping image note with no caption (OCR pending).');
          return;
        }
        contentToSave = imgMessage.caption;
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
      const setA = tokenizeText(contentToSave);
      for (const note of recentNotes) {
        const setB = tokenizeText(note.content);
        const score = jaccardSimilaritySets(setA, setB);
        if (score >= JACCARD_THRESHOLD) {
          console.log(`[noteHandler] Near-duplicate note detected (Jaccard: ${score.toFixed(2)}) — skipping save.`);
          return;
        }
      }
    }

    // --- Enforce max context length to protect DB and LLM Context Window ---
    const MAX_TEXT_LENGTH = 75000;
    if (contentToSave.length > MAX_TEXT_LENGTH) {
      console.log(`[noteHandler] Truncating massive note from ${contentToSave.length} to ${MAX_TEXT_LENGTH} characters.`);
      contentToSave = contentToSave.substring(0, MAX_TEXT_LENGTH) + '\\n\\n...[Content Truncated due to size limits]';
    }

    if (contentToSave.length > 20) {
       const info = await extractSubjectFromText(contentToSave, docMessage?.fileName);
       subject = info.subject;
       isPyq = info.is_pyq;
       year = info.year;
    }

    if (isPyq) {
      console.log(`[noteHandler] Auto-detected PYQ for ${subject}! Handing off to pyqHandler...`);
      await sock.sendMessage(chatId, { text: `🤖 *Class Copilot AI*\n\nI auto-detected that this document is actually a Past Year Question paper for *${subject}*!\nMoving it to the PYQ Agent...` }, { quoted: msg });
      
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
