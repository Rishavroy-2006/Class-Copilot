const schedule = require('node-schedule');
const supabase = require('../supabaseClient');
const { fastExtractJson } = require('../llmRouter');

async function extractDeadlineInfo(text) {
  const today = new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
  const prompt = `Analyze the following text and extract the deadline and description.
Today's date and time is ${today} in IST (Asia/Kolkata).
Return only a JSON object in this format: 
{"due_date": "YYYY-MM-DDTHH:MM:SS+05:30", "description": "Short description of the deadline"}

Text snippet:
${text}
`;

  try {
    const result = await fastExtractJson(prompt);
    return {
      due_date: result.due_date || null,
      description: result.description || text
    };
  } catch (error) {
    console.error('[deadlineHandler] Failed to extract deadline:', error);
    return { due_date: null, description: text };
  }
}

function scheduleReminder(sock, chatId, dueDateStr, description, deadlineId) {
  const dueDate = new Date(dueDateStr);
  if (isNaN(dueDate.getTime()) || dueDate < new Date()) {
    console.log(`[deadlineHandler] Invalid or past date for scheduling: ${dueDateStr}`);
    return;
  }

  // Schedule a reminder 24 hours before the deadline
  const reminderTime = new Date(dueDate.getTime() - (24 * 60 * 60 * 1000)); // 24 hours before
  
  if (reminderTime > new Date()) {
    schedule.scheduleJob(reminderTime, async () => {
      try {
        await sock.sendMessage(chatId, { text: `🤖 *Class Copilot Reminder*\n\n⏰ ${description} is due in 24 hours!` });
        if (deadlineId) {
          await supabase.from('deadlines').update({ reminder_sent: true }).eq('id', deadlineId);
        }
      } catch (err) {
        console.error('[deadlineHandler] Failed to send reminder:', err);
      }
    });
    console.log(`[deadlineHandler] Scheduled reminder for ${reminderTime.toISOString()}`);
  } else if (dueDate > new Date()) {
    console.log(`[deadlineHandler] Reminder time already passed, firing immediately for: ${description}`);
    try {
      // Fire it instantly since we are within the 24-hour window before the due date
      sock.sendMessage(chatId, { text: `🤖 *Class Copilot Reminder*\n\n⏰ Reminder: ${description} is coming up soon!` }).then(async () => {
        if (deadlineId) {
          await supabase.from('deadlines').update({ reminder_sent: true }).eq('id', deadlineId);
        }
      });
    } catch (err) {
      console.error('[deadlineHandler] Failed to send immediate reminder:', err);
    }
  }
}

async function handleDeadline(sock, msg, text, chatId) {
  const { due_date, description } = await extractDeadlineInfo(text);

  try {
    const { data, error } = await supabase
      .from('deadlines')
      .insert([
        { 
          chat_id: chatId, 
          due_date: due_date, 
          description: description,
          original_text: text // 👈 Saving the raw message for context
        }
      ])
      .select();

    if (error) {
      console.error('[deadlineHandler] Supabase insert error:', error);
    } else {
      console.log(`[deadlineHandler] Saved deadline: ${description} due at ${due_date}`);
      
      const deadlineId = data && data.length > 0 ? data[0].id : null;

      if (due_date) {
        scheduleReminder(sock, chatId, due_date, description, deadlineId);
      }
    }
  } catch (err) {
    console.error('[deadlineHandler] Error handling deadline:', err);
  }
}

async function loadAndScheduleExistingDeadlines(sock) {
  try {
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('deadlines')
      .select('*')
      .gt('due_date', now)
      .eq('reminder_sent', false);

    if (error) {
      console.error('[deadlineHandler] Failed to load existing deadlines:', error);
      return;
    }

    if (data && data.length > 0) {
      console.log(`[deadlineHandler] Rehydrating ${data.length} pending deadlines...`);
      for (const deadline of data) {
        scheduleReminder(sock, deadline.chat_id, deadline.due_date, deadline.description, deadline.id);
      }
    }
  } catch (err) {
    console.error('[deadlineHandler] Error rehydrating deadlines:', err);
  }
}

module.exports = { handleDeadline, loadAndScheduleExistingDeadlines };
