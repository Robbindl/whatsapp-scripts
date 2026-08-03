const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  Browsers,
} = require("@whiskeysockets/baileys");
const { Boom } = require("@hapi/boom");
const pino = require("pino");
const qrcode = require("qrcode-terminal");
const path = require("path");
const fs = require("fs");
const https = require("https");

let retryCount = 0;
const MAX_RETRIES = 5;
const sessionDir = path.join(__dirname, "session");
const qrOutputPath = path.join(__dirname, "qr-code.txt");
const conversationMemory = new Map();
const MAX_HISTORY = 10;
const NVIDIA_HOST = "integrate.api.nvidia.com";
const NVIDIA_PATH = "/v1/chat/completions";
const NVIDIA_MODEL = process.env.NVIDIA_MODEL || "meta/llama-3.1-8b-instruct";

function getConversationHistory(chatId, store = conversationMemory) {
  if (!store.has(chatId)) {
    store.set(chatId, []);
  }
  return store.get(chatId);
}

function appendConversationMessage(chatId, message, store = conversationMemory) {
  const history = getConversationHistory(chatId, store);
  history.push(message);

  while (history.length > MAX_HISTORY * 2) {
    history.shift();
  }

  store.set(chatId, history);
  return history;
}

function buildConversationMessages(history) {
  return [
    {
      role: "system",
      content:
        "You respond in VERY SHORT casual replies - just 1-2 sentences, like a text. Mix casual English and street Swahili. Use casual words: niko poa, uko sawa, ndiyo, sio, bro, sis, hehe. NEVER use formal Swahili. Keep it brief like texting. Example: if they say 'uko poa?' reply 'Niko poa bro' or 'Sawa sawa, you?'",
    },
    ...history,
  ];
}

function saveQrCode(qr) {
  const content = [
    "WhatsApp pairing QR code",
    new Date().toISOString(),
    qr,
    "",
  ].join("\n");

  fs.writeFileSync(qrOutputPath, content, "utf8");
  console.log(`QR code saved to ${qrOutputPath}`);
}

function callNvidiaChat(messages) {
  const apiKey = process.env.NVIDIA_API_KEY || process.env.ROBBIN_NVIDIA_API_KEY;
  if (!apiKey) {
    throw new Error("Set NVIDIA_API_KEY or ROBBIN_NVIDIA_API_KEY before starting the bot.");
  }

  const payload = JSON.stringify({
    model: NVIDIA_MODEL,
    messages,
    temperature: 0.3,
    max_tokens: 50,
    stream: false,
  });

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: NVIDIA_HOST,
        path: NVIDIA_PATH,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
          Accept: "application/json",
          "Content-Length": Buffer.byteLength(payload),
        },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => {
          data += chunk;
        });
        res.on("end", () => {
          if (res.statusCode >= 400) {
            reject(new Error(`NVIDIA API error ${res.statusCode}: ${data}`));
            return;
          }

          try {
            const parsed = JSON.parse(data);
            const reply =
              parsed.choices?.[0]?.message?.content?.trim() ||
              "I’m having trouble replying right now. Please try again in a moment.";
            resolve(reply);
          } catch (error) {
            reject(error);
          }
        });
      }
    );

    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

async function replyToMessage(sock, from, text) {
  const history = getConversationHistory(from);
  appendConversationMessage(from, { role: "user", content: text });

  try {
    const reply = await callNvidiaChat(buildConversationMessages(history));
    appendConversationMessage(from, { role: "assistant", content: reply });
    
    try {
      await sock.sendMessage(from, { text: reply });
    } catch (sendError) {
      console.error("Failed to send reply (connection issue):", sendError.message);
      if (sendError.output?.statusCode === 408 || sendError.output?.statusCode === 428) {
        console.log("WhatsApp connection lost. Waiting for reconnect...");
      }
    }
  } catch (error) {
    console.error("Failed to generate reply:", error.message);
    try {
      await sock.sendMessage(from, {
        text: "I'm having trouble replying right now. Please try again in a moment.",
      });
    } catch (fallbackError) {
      console.error("Could not send fallback message:", fallbackError.message);
    }
  }
}

async function start() {
  console.log("Starting WhatsApp bot (Robbin)...");
  console.log("Auth state directory:", sessionDir);

  const { state, saveCreds } = await useMultiFileAuthState(sessionDir);

  const sock = makeWASocket({
    auth: state,
    logger: pino({ level: "silent" }),
    browser: Browsers.ubuntu("Chrome"),
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update;
    console.log("connection.update:", JSON.stringify(update, null, 2));

    if (qr) {
      console.log("QR code received. Scan it with WhatsApp Web or the WhatsApp app.");
      saveQrCode(qr);
      qrcode.generate(qr, { small: true });
      console.log("If you do not see the QR code, copy the value below into a QR scanner:");
      console.log(qr);
    }

    if (connection === "open") {
      retryCount = 0;
      console.log("Connected to WhatsApp.");
      console.log("Session credentials are being stored in ./session/ so future restarts can reconnect without re-pairing.");
    }

    if (connection === "close") {
      console.log("lastDisconnect:", JSON.stringify(lastDisconnect, null, 2));
      const statusCode = Number(new Boom(lastDisconnect?.error)?.output?.statusCode);
      const conflictError = lastDisconnect?.error?.data?.tag === "conflict";
      const shouldReconnect =
        statusCode !== DisconnectReason.loggedOut &&
        statusCode !== 440 &&
        !conflictError;
      console.log("Connection closed. Status code:", statusCode, "| Reconnecting:", shouldReconnect);

      if (shouldReconnect) {
        retryCount++;
        if (retryCount > MAX_RETRIES) {
          console.error("Max retries reached. Stopping. Check your internet connection, close other WhatsApp sessions, then delete the session/ folder and try again.");
          process.exit(1);
        }
        const delay = Math.min(5000 * retryCount, 30000);
        console.log(`Retry ${retryCount}/${MAX_RETRIES} in ${delay / 1000}s...`);
        setTimeout(() => start(), delay);
      } else if (statusCode === DisconnectReason.loggedOut) {
        console.log("Logged out. Delete the session/ folder and run again to re-pair.");
      } else if (statusCode === 440 || conflictError) {
        console.log("Conflict detected. Another WhatsApp session replaced this one. Close other linked devices or remove the old session, then run again.");
      } else {
        console.log("Connection closed. Not reconnecting.");
      }
    }
  });

  sock.ev.on("messages.upsert", async ({ messages }) => {
    const msg = messages[0];
    if (!msg?.message || msg.key.fromMe) return;

    const from = msg.key.remoteJid;
    const text = msg.message.conversation || msg.message.extendedTextMessage?.text || "";

    if (!text.trim()) return;

    console.log(`Message from ${from}: ${text}`);
    await replyToMessage(sock, from, text);
  });
}

module.exports = {
  appendConversationMessage,
  buildConversationMessages,
  callNvidiaChat,
  start,
};

if (require.main === module) {
  start();
}
