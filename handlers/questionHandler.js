const supabase = require('../supabaseClient');
const { checkPromptGuard, generateAnswer } = require('../llmRouter');

async function handleQuestion(sock, msg, text, chatId) {
  // --- TROLL SHIELD (PROMPT GUARD via llmRouter) ---
  const { isTroll, score } = await checkPromptGuard(text);
  if (isTroll) {
    console.log(`[questionHandler] Troll Shield (Score: ${score.toFixed(3)}) activated for: "${text}"`);
    await sock.sendMessage(chatId, { text: `🤖 *Class Copilot AI*\n\nNice try, but I'm only here to answer class and academic questions! 😉` });
    return;
  }
  // --------------------

  // Fetch recent deadlines and notes for this specific group from Supabase
  let contextText = '';
  try {
    const { data: deadlines } = await supabase
      .from('deadlines')
      .select('description, due_date, original_text')
      .eq('chat_id', chatId)
      .order('id', { ascending: false })
      .limit(5);

    const { data: notes } = await supabase
      .from('notes')
      .select('subject, content')
      .eq('chat_id', chatId)
      .order('id', { ascending: false })
      .limit(5);

    if (deadlines && deadlines.length > 0) {
      contextText += '\nStored Group Deadlines/Announcements:\n' + 
        deadlines.map(d => `- Announcement (Due/Date: ${d.due_date || 'Unspecified'}):\n  "${(d.original_text || d.description).substring(0, 1000)}..."`).join('\n\n');
    }

    if (notes && notes.length > 0) {
      contextText += '\nStored Group Notes/Documents:\n' + 
        notes.map(n => `- [${n.subject}]:\n  "${n.content.substring(0, 6000)}..."`).join('\n\n');
    }
  } catch (err) {
    console.error('[questionHandler] Error fetching context from Supabase:', err);
  }

  const prompt = `You are Class Copilot, a helpful AI assistant in a college WhatsApp group.
Use the stored group context below to answer the student's question accurately. 

CRITICAL RULES:
1. If the answer is in the context, give a direct and accurate response based strictly on that information.
2. ALWAYS include specific dates, times, and deadlines in your answer if they are available in the context.
3. If the user's question is vague (like "what is the date?"), assume they are asking about the most recent announcement or event in the context.
4. ANTI-HALLUCINATION: The context often contains flattened tables (e.g. "4 431024010021 RISHAV ROY A 8334899417"). DO NOT merge adjacent numbers or letters. "ROY A" means Name: ROY, Section: A. It does NOT mean "Roya". "4 431..." means Serial 4, Roll 431... Do not combine them. Quote names and numbers exactly as they appear.

${contextText || 'No previous context stored yet.'}

Student Question: "${text}"

Answer:`;

  try {
    let answer = await generateAnswer(prompt, contextText.length);
    
    if (answer) {
      answer = answer.trim().replace(/^["']|["']$/g, '').trim();
      const formattedAnswer = `🤖 *Class Copilot AI*\n\n${answer}`;
      await sock.sendMessage(chatId, { text: formattedAnswer }, { quoted: msg });
      console.log('[questionHandler] Successfully replied to question.');
    }
  } catch (error) {
    console.error('[questionHandler] Failed to generate answer:', error);
  }
}

module.exports = { handleQuestion };
