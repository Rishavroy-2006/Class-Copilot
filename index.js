const {
  default: makeWASocket,
  useMultiFileAuthState,
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

async function startBridge() {
  // Saves your login session to ./auth so you don't have to re-scan the QR every time
  const { state, saveCreds } = await useMultiFileAuthState('auth');
  
  // Fetch the absolute latest WhatsApp Web version to avoid connection blocks
  const { version, isLatest } = await fetchLatestBaileysVersion();
  console.log(`[system] using WA v${version.join('.')}, isLatest: ${isLatest}`);

  const sock = makeWASocket({
    version,
    auth: state,
    logger: pino({ level: 'silent' }), // set to 'info' if you want verbose connection logs
  });

  // Fires whenever connection state changes (QR ready, connected, disconnected, etc.)
  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log('\nScan this QR code with WhatsApp (Linked Devices > Link a Device):\n');
      qrcode.generate(qr, { small: true });
    }

    if (connection === 'close') {
      const shouldReconnect =
        new Boom(lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut;
      console.log('Connection closed. Reconnecting:', shouldReconnect);
      if (shouldReconnect) startBridge();
    } else if (connection === 'open') {
      console.log('✅ Connected to WhatsApp!');
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

      const sender = msg.pushName || msg.key.participant || msg.key.remoteJid;
      const chatId = msg.key.remoteJid; // this is the group ID if it's a group message
      const isGroup = chatId?.endsWith('@g.us');

      const text =
        msg.message.conversation ||
        msg.message.extendedTextMessage?.text ||
        msg.message.imageMessage?.caption ||
        msg.message.documentMessage?.caption ||
        msg.message.videoMessage?.caption ||
        '';

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
          await handleNote(msg, text, chatId);
        } else if (category === 'DEADLINE') {
          await handleDeadline(sock, msg, text, chatId);
        } else if (category === 'QUESTION') {
          await handleQuestion(sock, msg, text, chatId);
        }
        // NOISE messages are simply skipped
      } catch (err) {
        console.error(`[index] Failed to process message ${msg.key.id}:`, err);
      }
    }
  });
}

startBridge();
