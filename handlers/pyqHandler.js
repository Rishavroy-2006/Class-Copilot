const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const pdfParse = require('pdf-parse');
const supabase = require('../supabaseClient');
const { fastExtractJson, generatePredictionJson } = require('../llmRouter');

async function handlePyq(sock, msg, text, chatId) {
  const docMessage = msg.message?.documentMessage;
  if (!docMessage) {
    await sock.sendMessage(chatId, { text: `🤖 *Class Copilot AI*\n\nPlease attach a PDF document with your PYQ caption to generate predictions.` }, { quoted: msg });
    return;
  }

  if (docMessage.mimetype !== 'application/pdf') {
    await sock.sendMessage(chatId, { text: `🤖 *Class Copilot AI*\n\nI only support PDF files for Past Year Questions (PYQ) right now.` }, { quoted: msg });
    return;
  }

  // 1. Extract subject from the caption
  const promptForSubject = `Extract the academic subject name from this text. Ignore 'PYQ' or commands.
Text: "${text}"
Return JSON in format: {"subject": "Subject Name", "year": "2023 or unknown"}`;
  
  let subjectInfo = { subject: 'Unknown', year: 'unknown' };
  try {
    subjectInfo = await fastExtractJson(promptForSubject);
  } catch(e) {
    console.error('[pyqHandler] Failed to extract subject:', e);
  }

  const subject = subjectInfo.subject || 'Unknown';
  const year = subjectInfo.year || 'unknown';

  await sock.sendMessage(chatId, { text: `🤖 *Class Copilot AI*\n\nDownloading and parsing past paper for *${subject}*...` }, { quoted: msg });

  // 2. Download and parse PDF
  let rawText = '';
  try {
    const stream = await downloadContentFromMessage(docMessage, 'document');
    const chunks = [];
    for await (const chunk of stream) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);
    const pdfData = await pdfParse(buffer);
    rawText = pdfData.text.trim();
  } catch (err) {
    console.error('[pyqHandler] Failed to parse PDF:', err);
    await sock.sendMessage(chatId, { text: `🤖 *Class Copilot AI*\n\nFailed to extract text from the provided PDF.` }, { quoted: msg });
    return;
  }

  // 3. Process the extracted text
  await processPyqText(sock, chatId, subject, year, rawText);
}

async function processPyqText(sock, chatId, subject, year, rawText) {
  // 3. Save to past_papers
  const { error: insertErr } = await supabase
    .from('past_papers')
    .insert([{ chat_id: chatId, subject, year, raw_text: rawText }]);

  if (insertErr) {
    console.error('[pyqHandler] Failed to save paper:', insertErr);
    await sock.sendMessage(chatId, { text: `🤖 *Class Copilot AI*\n\nDatabase error while saving the paper.` }, { quoted: msg });
    return;
  }

  // 4. Fetch all papers for this subject
  const { data: allPapers, error: fetchErr } = await supabase
    .from('past_papers')
    .select('raw_text, year')
    .eq('chat_id', chatId)
    .eq('subject', subject);

  if (fetchErr) {
    console.error('[pyqHandler] Failed to fetch past papers:', fetchErr);
    return;
  }

  if (allPapers.length < 2) {
    await sock.sendMessage(chatId, { text: `🤖 *Class Copilot AI*\n\n✅ Past paper for *${subject}* saved.\n\nI need at least 2 papers to find patterns. Please upload more past papers for this subject.` }, { quoted: msg });
    return;
  }

  // 5. Concatenate texts and trigger prediction
  await sock.sendMessage(chatId, { text: `🤖 *Class Copilot AI*\n\nRunning analysis on ${allPapers.length} past papers for *${subject}* to predict high-probability topics...` });
  
  const concatenatedText = allPapers.map(p => `---PAPER (${p.year})---\n${p.raw_text}`).join('\n\n');
  const contextLength = concatenatedText.length;

  const predictPrompt = `You are an expert exam predictor analyzing past year university exam papers.
Find patterns and predict the highest probability topics that are likely to appear in the next exam based on the frequency in past papers.
  
PAST PAPERS TEXT:
${concatenatedText}

Return a valid JSON object in the following format exactly:
{
  "high_probability_topics": [
    {
      "topic": "The exact topic name",
      "appears_in_papers": Number (how many times it appeared),
      "confidence": "High/Medium",
      "example_question": "A typical question asked about this topic"
    }
  ],
  "notes": "A short 1-2 sentence overall advice based on the trends"
}
`;

  try {
    const predictionObj = await generatePredictionJson(predictPrompt, contextLength);
    
    // 6. Upsert to predictions table
    // Supabase upsert requires unique constraint on (chat_id, subject) or we do delete-insert.
    // Assuming no unique constraint, we'll just delete existing and insert new to simulate upsert cleanly.
    await supabase.from('predictions').delete().eq('chat_id', chatId).eq('subject', subject);
    
    await supabase.from('predictions').insert([{
      chat_id: chatId,
      subject: subject,
      predicted_topics: predictionObj.high_probability_topics || [],
      papers_analyzed: allPapers.length
    }]);

    // 7. Format reply
    let replyText = `🤖 *Class Copilot AI: Predictor*\n\nBased on ${allPapers.length} past papers for *${subject}*, here are the high-probability topics to study:\n\n`;
    
    if (predictionObj.high_probability_topics && predictionObj.high_probability_topics.length > 0) {
      predictionObj.high_probability_topics.slice(0, 5).forEach((t, i) => {
        replyText += `*${i+1}. ${t.topic}*\n`;
        replyText += `🔥 Confidence: ${t.confidence} (Appeared ${t.appears_in_papers}x)\n`;
        replyText += `💡 Example: _${t.example_question}_\n\n`;
      });
    } else {
      replyText += `No clear recurring topics found.\n\n`;
    }

    if (predictionObj.notes) {
      replyText += `📝 *Advice:* ${predictionObj.notes}`;
    }

    await sock.sendMessage(chatId, { text: replyText });

  } catch (err) {
    console.error('[pyqHandler] LLM Prediction failed:', err);
    await sock.sendMessage(chatId, { text: `🤖 *Class Copilot AI*\n\nSorry, the AI prediction engine timed out or failed while analyzing these papers.` });
  }
}

module.exports = { handlePyq, processPyqText };
