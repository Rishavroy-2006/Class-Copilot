const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const pdfParse = require('pdf-parse');
const supabase = require('../supabaseClient');
const { fastExtractJson } = require('../llmRouter');

async function extractSubjectFromText(text) {
  const prompt = `Analyze the following text and determine the most likely academic subject (e.g., Mathematics, Physics, History, Computer Science). 
Return only a JSON object in this format: {"subject": "Subject Name"}

Text snippet:
${text.substring(0, 1000)}...`;

  try {
    const result = await fastExtractJson(prompt);
    return result.subject || 'General';
  } catch (error) {
    console.error('[noteHandler] Failed to extract subject:', error);
    return 'General';
  }
}

async function handleNote(msg, text, chatId) {
  let contentToSave = text;
  let subject = 'General';

  try {
    const docMessage = msg.message?.documentMessage;
    const imgMessage = msg.message?.imageMessage;

    if (docMessage) {
      if (docMessage.mimetype === 'application/pdf') {
        // Download and parse PDF
        const stream = await downloadContentFromMessage(docMessage, 'document');
        let buffer = Buffer.from([]);
        for await (const chunk of stream) {
          buffer = Buffer.concat([buffer, chunk]);
        }
        
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

    if (contentToSave.length > 20) {
       subject = await extractSubjectFromText(contentToSave);
    }

    // Save to Supabase
    const { data, error } = await supabase
      .from('notes')
      .insert([
        { chat_id: chatId, subject: subject, content: contentToSave }
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
