const { generateSummary } = require('../llmRouter');

/**
 * Handle a "summarize this" command
 */
async function handleSummary(sock, msg, quotedText, chatId) {
  try {
    console.log(`[summaryHandler] Generating summary for text length: ${quotedText.length}`);
    
    // React to let user know we are processing it
    await sock.sendMessage(chatId, { react: { text: "📝", key: msg.key } });

    // Generate summary
    const summary = await generateSummary(quotedText);

    // Send summary back as a reply
    const replyText = `*Summary:*\n\n${summary}`;
    await sock.sendMessage(chatId, { text: replyText }, { quoted: msg });

    console.log('[summaryHandler] Summary sent successfully.');
  } catch (err) {
    console.error('[summaryHandler] Error handling summary:', err.message);
  }
}

module.exports = { handleSummary };
