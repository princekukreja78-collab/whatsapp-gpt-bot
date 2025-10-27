// server.js
// WhatsApp + Hugging Face GPT integration example
// Prerequisites: npm install express node-fetch@2

const express = require('express');
const fetch = require('node-fetch');
const app = express();
app.use(express.json());

const VERIFY_TOKEN = process.env.VERIFY_TOKEN || 'MrCarSecure2025';
const WA_TOKEN = process.env.WA_TOKEN || '';
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID || '';
const HF_API_KEY = process.env.HF_API_KEY || '';
const HF_MODEL = process.env.HF_MODEL || 'gpt2';

app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('Webhook verified ✅');
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

app.post('/webhook', async (req, res) => {
  res.sendStatus(200);
  try {
    const body = req.body;
    console.log('📩 Incoming webhook:', JSON.stringify(body, null, 2));
    if (!body.entry) return;
    for (const entry of body.entry) {
      const changes = entry.changes || [];
      for (const change of changes) {
        const value = change.value || {};
        const messages = value.messages || [];
        for (const msg of messages) {
          const from = msg.from;
          const text = msg.text?.body || '';
          if (!text) continue;
          console.log(`💬 Message from ${from}: ${text}`);
          const replyText = await getGPTReply(text).catch(err => {
            console.error('❌ GPT error:', err);
            return "Sorry, I couldn't process that right now.";
          });
          await sendWhatsAppMessage(from, replyText).catch(err => {
            console.error('❌ WhatsApp send error:', err);
          });
        }
      }
    }
  } catch (err) {
    console.error('❌ Webhook handler error:', err);
  }
});

async function getGPTReply(userText) {
  if (!HF_API_KEY) {
    console.warn('⚠️ No HF_API_KEY found — using fallback echo');
    return `Echo: ${userText}`;
  }
  const url = `https://api-inference.huggingface.co/models/${HF_MODEL}`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${HF_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ inputs: userText })
  });
  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`HF error ${resp.status}: ${errText}`);
  }
  const data = await resp.json();
  if (Array.isArray(data) && data[0]?.generated_text) return data[0].generated_text;
  if (data.generated_text) return data.generated_text;
  return typeof data === 'string' ? data : JSON.stringify(data).slice(0, 500);
}

async function sendWhatsAppMessage(to, text) {
  if (!WA_TOKEN || !PHONE_NUMBER_ID) {
    console.error('⚠️ WA_TOKEN or PHONE_NUMBER_ID missing');
    return;
  }
  const url = `https://graph.facebook.com/v17.0/${PHONE_NUMBER_ID}/messages`;
  const payload = {
    messaging_product: 'whatsapp',
    to,
    type: 'text',
    text: { body: text }
  };
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${WA_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  console.log('📤 WhatsApp send response:', JSON.stringify(data, null, 2));
}

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`🚀 Server live on port ${port}`));
