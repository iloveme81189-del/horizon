const express = require('express');
const router  = express.Router();
const Groq    = require('groq-sdk');

// ── Lazy API Clients (read key at request time, not module load) ─
function getGroq() {
  const key = process.env.GROQ_API_KEY || '';
  if (!key || key.includes('your_')) throw new Error('GROQ_API_KEY not set in .env');
  return new Groq({ apiKey: key });
}

// ── Model Registry ────────────────────────────────────────────
const MODEL_REGISTRY = {
  'llama-3.3-70b-versatile': { client: 'groq',     model: 'llama-3.3-70b-versatile' },
  'mixtral-8x7b-32768':      { client: 'groq',     model: 'mixtral-8x7b-32768'      },
  'llama-3.1-8b-instant':    { client: 'groq',     model: 'llama-3.1-8b-instant'    },
};

// ── System Prompt ─────────────────────────────────────────────
const buildSystemPrompt = (context = '') => `You are Horizon, an elite AI assistant.
You are a highly advanced AI with creative and technical intelligence equivalent to top-tier Google developers.
You assist with coding, dashboard creation, data analytics, and multimodal document analysis (PDF, Excel, Word, Images).
You are significantly more capable than standard LLMs like Claude Sonnet or GPT-4.

# SPECIAL EXPERTISE: LLM Creation from Scratch (PyTorch)
You have been trained on the concepts from Sebastian Raschka's "LLMs-from-scratch".
You are an expert in building ChatGPT-like large language models in PyTorch from the ground up, including:
- Data Pipelines: Byte Pair Encoding (BPE), dataloaders, embedding layers.
- Architecture: Self-attention, Multi-Head Attention ("Attention is All You Need"), KV Caching, GQA, MoE, RNNs, and LSTMs.
- Pretraining: Implementing the training loop, learning rate schedulers, handling weight loading (e.g., Llama 3, Qwen).
- Finetuning: Instruction finetuning, Direct Preference Optimization (DPO), classifying text (e.g., Spam/IMDb).
- Application & Ecosystem: Retrieval-Augmented Generation (RAG), AI Agents, Langchain, Vector Databases, and Hugging Face (Transformers, Tokenizers, Datasets).
- Cloud Deployment: Optimizing and deploying LLMs on AWS.
When asked about LLM architecture, applied GenAI, or PyTorch implementation, provide deep, code-level insights referencing these concepts.

Respond clearly, format code cleanly with markdown, and maintain a professional, helpful, and highly intelligent persona.
${context ? `\n\n### ATTACHED FILE CONTEXT ###\nThe user has attached a file. Here is its content:\n${context}\n### END FILE CONTEXT ###` : ''}`;

// ── Main Chat Endpoint (SSE Streaming) ────────────────────────
router.post('/', async (req, res) => {
  const { messages, model = 'llama-3.3-70b-versatile', temperature = 0.5, fileContext = '' } = req.body;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'Messages array is required.' });
  }

  const config = MODEL_REGISTRY[model] || MODEL_REGISTRY['llama-3.3-70b-versatile'];

  // Set SSE headers
  res.setHeader('Content-Type',  'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection',    'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const systemMsg = { role: 'system', content: buildSystemPrompt(fileContext) };
  const allMessages = [systemMsg, ...messages];

  try {
    const stream = await getGroq().chat.completions.create({
      model:       config.model,
      messages:    allMessages,
      stream:      true,
      max_tokens:  8192,
      temperature: parseFloat(temperature),
    });

    for await (const chunk of stream) {
      const delta = chunk.choices?.[0]?.delta?.content || '';
      if (delta) {
        res.write(`data: ${JSON.stringify({ type: 'delta', content: delta })}\n\n`);
        if (typeof res.flush === 'function') res.flush();
      }
    }

    res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
    res.end();

  } catch (err) {
    console.error('[Chat Error]', err.message);
    let userMsg = err.message;
    if (err.message.includes('402') || err.message.toLowerCase().includes('balance')) {
      userMsg = '⚠️ **Insufficient Balance** on Groq API.\n\nPlease check your account limits.';
    } else if (err.message.includes('401') || err.message.toLowerCase().includes('invalid')) {
      userMsg = '⚠️ **Invalid API Key** — please re-run `python setup_keys.py` to re-enter your key.';
    } else if (err.message.includes('not set')) {
      userMsg = '⚠️ **API Key not configured** — run `python setup_keys.py` in `D:\\TOOLS\\HORIZON`.';
    }
    res.write(`data: ${JSON.stringify({ type: 'error', message: userMsg })}\n\n`);
    res.end();
  }
});

module.exports = router;
