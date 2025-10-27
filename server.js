// server.js
// WhatsApp + Hugging Face GPT integration example (Node 22 ready, no node-fetch needed)

import express from "express";

const app = express();
app.use(express.json());

// Environment variables (Render → Environment tab)
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || "MrCarSecure2025";
const WA_TOKEN = process.env.WA_TOKEN || "";
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID || "";
const HF_API_KEY = process.env.HF_API_KEY || "";
const HF_MODEL = process.env.HF_MODEL || "tiiuae/falcon-7b-instruct";

// Root check
app.get("/", (req, res) => {
  res.send("✅ Mr.Car WhatsApp GPT Bot is live and running!");
});

// Webhook verification (for Meta)
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("Webhook verified ✅");
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

// Webhook receiver (for WhatsApp messages)
app.post("/webhook", async (req, res) => {
  res.sendStatus(200);
  try {
    const body = req.body;
    console.log("📩 Incoming webhook:", JSON.stringify(body, null, 2));

    if (!body.entry) return;
    for (const entry of body.entry) {
      const changes = entry.changes || [];
      for (const change of changes) {
        const messages = change.value?.messages || [];
        for (const msg of messages) {
          const from = msg.from;
          const text = msg.text?.body?.trim();
          if (!text) continue;

          console.log(`💬 Message from ${from}: ${text}`);
          const reply = await getGPTReply(text);
          await sendWhatsAppMessage(from, reply);
        }
      }
    }
  } catch (err) {
    console.error("❌ Webhook error:", err);
  }
});

// Hugging Face reply
async function getGPTReply(prompt) {
  if (!HF_API_KEY) {
    return `Echo: ${prompt}`;
  }
  try {
    const resp = await fetch(`https://api-inference.huggingface.co/models/${HF_MODEL}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${HF_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ inputs: prompt }),
    });
    const data = await resp.json();
    if (Array.isArray(data) && data[0]?.generated_text) return data[0].generated_text;
    if (data.generated_text) return data.generated_text;
    return JSON.stringify(data).slice(0, 300);
  } catch (e) {
    console.error("HF API error:", e);
    return "Sorry, AI is temporarily unavailable.";
  }
}

// Send WhatsApp message
async function sendWhatsAppMessage(to, text) {
  if (!WA_TOKEN || !PHONE_NUMBER_ID) {
    console.error("Missing WA_TOKEN or PHONE_NUMBER_ID");
    return;
  }
  const url = `https://graph.facebook.com/v17.0/${PHONE_NUMBER_ID}/messages`;
  const payload = {
    messaging_product: "whatsapp",
    to,
    type: "text",
    text: { body: text },
  };

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${WA_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const result = await resp.json();
  console.log("📤 WhatsApp send response:", result);
}

// Start server
const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`🚀 Server running on port ${port}`));

