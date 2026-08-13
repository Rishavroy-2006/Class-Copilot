const {
  default: makeWASocket,
  DisconnectReason,
  fetchLatestBaileysVersion,
} = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const qrcode = require('qrcode-terminal');
const pino = require('pino');
const { classifyMessage } = require('./classifier');
const { handleNote } = require('./handlers/noteHandler');
const { handleDeadline, loadAndScheduleExistingDeadlines } = require('./handlers/deadlineHandler');
const { handleQuestion } = require('./handlers/questionHandler');
const { handleSummary } = require('./handlers/summaryHandler');
const { handlePyq } = require('./handlers/pyqHandler');
const http = require('http');
const supabase = require('./supabaseClient');
const { useSupabaseAuthState } = require('./supabaseAuthState');

let isShuttingDown = false;
let currentSock = null;
let isConnected = false;

async function startBridge() {
  if (isShuttingDown) return;

  // Uses Supabase to store authentication state, allowing sessions to persist across Render restarts
  const { state, saveCreds } = await useSupabaseAuthState(supabase, 'class_copilot_session');
  
  // Fetch the absolute latest WhatsApp Web version to avoid connection blocks
  const { version, isLatest } = await fetchLatestBaileysVersion();
  console.log(`[system] using WA v${version.join('.')}, isLatest: ${isLatest}`);

  const sock = makeWASocket({
    version,
    auth: state,
    logger: pino({ level: 'silent' }), // set to 'info' if you want verbose connection logs
  });
  
  currentSock = sock;

  // Fires whenever connection state changes (QR ready, connected, disconnected, etc.)
  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log('\nScan this QR code with WhatsApp (Linked Devices > Link a Device):\n');
      qrcode.generate(qr, { small: true });
    }

    if (connection === 'close') {
      isConnected = false;
      const willReconnect = !isShuttingDown &&
        new Boom(lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut;
      console.log('Connection closed. Reconnecting:', willReconnect);
      if (willReconnect) startBridge();
    } else if (connection === 'open') {
      console.log('✅ Connected to WhatsApp!');
      isConnected = true;
      loadAndScheduleExistingDeadlines(sock);
    }
  });

  // Save login credentials whenever they update
  sock.ev.on('creds.update', saveCreds);

  // This is the part that matters for Class Copilot: capture every incoming message
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;

    for (const msg of messages) {
      if (!msg.message) continue; // skip protocol/system messages
      if (msg.key.fromMe) continue; // skip messages sent by this bot's own linked account
      
      const botJid = sock.user?.id ? sock.user.id.split(':')[0].split('@')[0] + '@s.whatsapp.net' : null;
      if (botJid && msg.key.participant === botJid) continue; // strictly ignore own messages in groups

      const sender = msg.pushName || msg.key.participant || msg.key.remoteJid;
      const chatId = msg.key.remoteJid; // this is the group ID if it's a group message
      const isGroup = chatId?.endsWith('@g.us');

      // Class Copilot only operates in group chats — silently ignore DMs and broadcasts
      if (!isGroup) continue;

      const text =
        msg.message.conversation ||
        msg.message.extendedTextMessage?.text ||
        msg.message.imageMessage?.caption ||
        msg.message.documentMessage?.caption ||
        msg.message.videoMessage?.caption ||
        '';

      const contextInfo = msg.message.extendedTextMessage?.contextInfo;
      const quotedMessage = contextInfo?.quotedMessage;
      let quotedText = '';
      if (quotedMessage) {
        quotedText = 
          quotedMessage.conversation || 
          quotedMessage.extendedTextMessage?.text || 
          quotedMessage.imageMessage?.caption || 
          '';
      }

      if (text.toLowerCase().includes('summarize') && quotedText.length > 20) {
        console.log(`[index] Routing to summary handler for user request: ${text}`);
        await handleSummary(sock, msg, quotedText, chatId);
        continue;
      }

      // Catch errors per-message so one bad apple doesn't spoil the batch
      try {
        const { category, method } = await classifyMessage(text, msg);

        console.log('---------------------------------');
        console.log('From:', sender);
        console.log('Chat:', isGroup ? `Group (${chatId})` : 'Direct message');
        console.log('Text:', text);
        console.log(`Category: ${category} (via ${method})`);
        console.log('---------------------------------');

        // 👉 Next step: route based on category
        if (category === 'NOTE') {
          await handleNote(msg, text, chatId, sock);
        } else if (category === 'DEADLINE') {
          await handleDeadline(sock, msg, text, chatId);
        } else if (category === 'PYQ') {
          const botNumber = sock.user.id.split(':')[0].split('@')[0];
          const botJid = `${botNumber}@s.whatsapp.net`;
          const botLid = sock.user.lid ? sock.user.lid.split(':')[0].split('@')[0] : null;
          
          const mentionedJids = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
          const isMentioned =
            mentionedJids.includes(botJid) ||
            (botLid && mentionedJids.some(jid => jid.split('@')[0] === botLid)) ||
            text.includes(`@${botNumber}`);
            
          const hasDoc = !!(msg.message?.documentMessage || msg.message?.documentWithCaptionMessage?.message?.documentMessage);
          const isExplicitCommand = /^\/?(predict|pyq)/i.test(text.trim());
          
          if (!isGroup || hasDoc || isExplicitCommand || isMentioned) {
            await handlePyq(sock, msg, text, chatId);
          } else {
            console.log('[index] Skipped group PYQ request because bot was not @mentioned.');
          }
        } else if (category === 'QUESTION') {
          // Normalize bot's JID safely (strip any existing :port or @domain first)
          const botNumber = sock.user.id.split(':')[0].split('@')[0];
          const botJid = `${botNumber}@s.whatsapp.net`;
          // WhatsApp uses a privacy-preserving Linked ID (LID) for group mentions
          const botLid = sock.user.lid ? sock.user.lid.split(':')[0].split('@')[0] : null;
          
          // Check if bot was @mentioned: match phone JID, LID, or raw text tag
          const mentionedJids = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
          const isMentioned =
            mentionedJids.includes(botJid) ||
            (botLid && mentionedJids.some(jid => jid.split('@')[0] === botLid)) ||
            text.includes(`@${botNumber}`);
          
          console.log(`[debug] botNumber: ${botNumber}, botLid: ${botLid}`);
          console.log(`[debug] mentionedJids:`, mentionedJids);
          console.log(`[debug] isMentioned: ${isMentioned}`);
          
          // Check if the user is directly replying to a previous bot message
          const repliedToJid = msg.message?.extendedTextMessage?.contextInfo?.participant;
          const isReplyToBot = repliedToJid === botJid;

          // Only answer group questions if explicitly mentioned or replied to. Always answer DMs.
          if (!isGroup || isMentioned || isReplyToBot) {
            await handleQuestion(sock, msg, text, chatId);
          } else {
            console.log('[index] Skipped group question because bot was not @mentioned.');
          }
        }
        // NOISE messages are simply skipped
      } catch (err) {
        console.error(`[index] Failed to process message ${msg.key.id}:`, err);
      }
    }
  });
}

const PORT = process.env.PORT || 10000;
const server = http.createServer((req, res) => {
  if (req.url === '/health' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      status: 'ok', 
      whatsapp: isConnected ? 'connected' : 'disconnected',
      timestamp: new Date().toISOString() 
    }));
  } else {
    res.writeHead(404);
    res.end();
  }
});

server.listen(PORT, () => {
  console.log(`[system] Health check server listening on port ${PORT}`);
});

// Graceful Shutdown Sequence
const shutdown = async () => {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log('\\n[system] Gracefully shutting down...');
  
  // 1. Close HTTP server so uptime monitors know it's down
  server.close(() => {
    console.log('[system] HTTP server closed.');
  });

  // 2. End WhatsApp connection if it exists
  if (currentSock) {
    try {
      console.log('[system] Closing WhatsApp socket...');
      currentSock.end(undefined);
    } catch (e) {
      console.error('[system] Error closing socket:', e);
    }
  }

  // 3. Allow pending operations (like saveCreds / Supabase calls) to finish before exit
  setTimeout(() => {
    console.log('[system] Process exiting cleanly.');
    process.exit(0);
  }, 3000);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

startBridge();
