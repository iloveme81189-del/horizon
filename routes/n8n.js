const express = require('express');
const router  = express.Router();
const Groq    = require('groq-sdk');
const OpenAI  = require('openai');

// ── Reuse the same model registry & persona logic from chat.js ──
const MODEL_REGISTRY = {
  'llama-3.3-70b-versatile':       { client: 'groq',       model: 'llama-3.3-70b-versatile' },
  'mixtral-8x7b-32768':            { client: 'groq',       model: 'mixtral-8x7b-32768'      },
  'llama-3.1-8b-instant':          { client: 'groq',       model: 'llama-3.1-8b-instant'    },
  'nvidia/nemotron-3-ultra-550b':  { client: 'openrouter', model: 'nvidia/nemotron-3-ultra-550b' },
  'openai/gpt-oss-120b':           { client: 'openrouter', model: 'openai/gpt-oss-120b'         },
};

function getGroq() {
  const key = process.env.GROQ_API_KEY || '';
  if (!key || key.includes('your_')) throw new Error('GROQ_API_KEY not set');
  return new Groq({ apiKey: key });
}

function getOpenRouter() {
  const key = process.env.OPENROUTER_API_KEY || '';
  if (!key || key.includes('your_')) throw new Error('OPENROUTER_API_KEY not set');
  return new OpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: key,
    defaultHeaders: {
      'HTTP-Referer': 'https://horizon-iw1o.onrender.com',
      'X-Title': 'HorizonAI',
    },
  });
}

// ── n8n Webhook Endpoint ──────────────────────────────────────
// Accepts: POST { message, sessionId?, model? }
// Returns: { reply, model, sessionId, persona, timestamp }
router.post('/', async (req, res) => {
  const { message, sessionId, model = 'llama-3.3-70b-versatile' } = req.body || {};

  if (!message) {
    return res.status(400).json({ error: 'Missing "message" field in request body.' });
  }

  const config = MODEL_REGISTRY[model] || MODEL_REGISTRY['llama-3.3-70b-versatile'];
  const sid = sessionId || `n8n_${Date.now()}`;

  const systemPrompt = `You are Horizon, an elite AI assistant created by Dr. Hari Krishna.
You are responding to a request forwarded from an n8n automation workflow.
Respond concisely and precisely. Format code with markdown. Never emit placeholders.`;

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: message },
  ];

  try {
    let completion;

    if (config.client === 'openrouter') {
      completion = await getOpenRouter().chat.completions.create({
        model:       config.model,
        messages,
        max_tokens:  8192,
        temperature: 0.5,
      });
    } else {
      completion = await getGroq().chat.completions.create({
        model:       config.model,
        messages,
        max_tokens:  8192,
        temperature: 0.5,
      });
    }

    const reply = completion.choices?.[0]?.message?.content || '';

    res.json({
      reply,
      model: config.model,
      sessionId: sid,
      persona: 'Horizon',
      timestamp: new Date().toISOString(),
    });

  } catch (err) {
    console.error('[n8n Webhook Error]', err.message);
    res.status(500).json({
      error: err.message,
      model: config.model,
      sessionId: sid,
      timestamp: new Date().toISOString(),
    });
  }
});

module.exports = router;
