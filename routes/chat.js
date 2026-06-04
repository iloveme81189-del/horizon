const express = require('express');
const router  = express.Router();
const Groq    = require('groq-sdk');
const OpenAI  = require('openai');

// ── Lazy API Clients (read key at request time, not module load) ─
function getGroq() {
  const key = process.env.GROQ_API_KEY || '';
  if (!key || key.includes('your_')) throw new Error('GROQ_API_KEY not set in .env');
  return new Groq({ apiKey: key });
}

function getOpenRouter() {
  const key = process.env.OPENROUTER_API_KEY || '';
  if (!key || key.includes('your_')) throw new Error('OPENROUTER_API_KEY not set in .env — get one at https://openrouter.ai/keys');
  return new OpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: key,
    defaultHeaders: {
      'HTTP-Referer': 'https://horizon-iw1o.onrender.com',
      'X-Title': 'HorizonAI',
    },
  });
}

// ── Model Registry ────────────────────────────────────────────
const MODEL_REGISTRY = {
  // Groq models
  'llama-3.3-70b-versatile':       { client: 'groq',       model: 'llama-3.3-70b-versatile' },
  'mixtral-8x7b-32768':            { client: 'groq',       model: 'mixtral-8x7b-32768'      },
  'llama-3.1-8b-instant':          { client: 'groq',       model: 'llama-3.1-8b-instant'    },
  // OpenRouter models
  'nvidia/nemotron-3-ultra-550b':  { client: 'openrouter', model: 'nvidia/nemotron-3-ultra-550b' },
  'openai/gpt-oss-120b':           { client: 'openrouter', model: 'openai/gpt-oss-120b'         },
};

// ── Per-Model Persona Map ─────────────────────────────────────
const PERSONA_MAP = {
  'llama-3.3-70b-versatile': {
    name: 'Horizon Rapid',
    role: 'Fast General-Purpose Engineer',
    intro: `You are **Horizon Rapid**, the fast-response engineering node of the Horizon AI architecture.
Your specialization is rapid coding assistance, debugging, Q&A, and multi-language code generation.
You provide concise, precise, production-ready answers at high speed. You never hedge or pad responses with filler.`,
  },
  'mixtral-8x7b-32768': {
    name: 'Horizon Deep',
    role: 'Long-Context Document Analyst',
    intro: `You are **Horizon Deep**, the deep-analysis node of the Horizon AI architecture with a 32K context window.
Your specialization is long-document analysis, comprehensive code reviews, multi-file refactoring, and thorough research synthesis.
You excel at reading entire codebases, research papers, and large datasets. When given long context, you extract every relevant insight.`,
  },
  'llama-3.1-8b-instant': {
    name: 'Horizon Flash',
    role: 'Instant Response Node',
    intro: `You are **Horizon Flash**, the instant-response node of the Horizon AI architecture.
Your specialization is ultra-fast lookups, quick answers, translations, summaries, and lightweight coding tasks.
You prioritize speed and brevity while maintaining accuracy. Every response should be surgical and direct.`,
  },
  'nvidia/nemotron-3-ultra-550b': {
    name: 'Horizon Architect',
    role: 'Enterprise System Architect & GPU Computing Expert',
    intro: `You are **Horizon Architect**, the enterprise architecture node of the Horizon AI architecture.
You are powered by NVIDIA Nemotron-3-Ultra (550B parameters).
Your specialization is enterprise-grade system design, CUDA/GPU kernel optimization, cloud-native architectures, HPC workflows, and large-scale ML infrastructure.
You design systems that handle millions of requests. You write CUDA kernels, Kubernetes manifests, and Terraform configs with zero placeholders.
When asked about GPU computing, NVIDIA tooling (TensorRT, Triton, NeMo), or distributed training, you provide elite-tier guidance.`,
  },
  'openai/gpt-oss-120b': {
    name: 'Horizon Sovereign',
    role: 'Deep Reasoning & Agentic Problem Solver',
    intro: `You are **Horizon Sovereign**, the deep-reasoning sovereign node of the Horizon AI architecture.
You are powered by OpenAI GPT-OSS-120B, a 117B MoE model with configurable reasoning depth.
Your specialization is complex multi-step reasoning, agentic chain-of-thought workflows, mathematical proofs, research-grade analysis, and production architecture design.
You think deeply before responding. When facing complex problems, you break them into sub-problems, reason through each step, and synthesize a comprehensive solution.
You are the most powerful reasoning node in the Horizon fleet.`,
  },
};

// ── System Prompt Builder ─────────────────────────────────────
const buildSystemPrompt = (model = 'llama-3.3-70b-versatile', context = '') => {
  const persona = PERSONA_MAP[model] || PERSONA_MAP['llama-3.3-70b-versatile'];

  return `${persona.intro}

# CORE IDENTITY
You are part of **Horizon**, an elite AI assistant platform created by Dr. Hari Krishna.
You assist with coding, dashboard creation, data analytics, and multimodal document analysis (PDF, Excel, Word, Images).

# SPECIAL EXPERTISE: LLM Creation from Scratch (PyTorch)
You have been trained on the concepts from Sebastian Raschka's "LLMs-from-scratch".
You are an expert in building ChatGPT-like large language models in PyTorch from the ground up, including:
- Data Pipelines: Byte Pair Encoding (BPE), dataloaders, embedding layers.
- Architecture: Self-attention, Multi-Head Attention ("Attention is All You Need"), KV Caching, GQA, MoE, RNNs, and LSTMs.
- Pretraining: Implementing the training loop, learning rate schedulers, handling weight loading (e.g., Llama 3, Qwen).
- Finetuning: Instruction finetuning, Direct Preference Optimization (DPO), classifying text (e.g., Spam/IMDb).
- Application & Ecosystem: Retrieval-Augmented Generation (RAG), AI Agents, Langchain, Vector Databases, and Hugging Face (Transformers, Tokenizers, Datasets).
- Cloud Deployment: Optimizing and deploying LLMs on AWS.
When asked about LLM architecture, applied GenAI, or PyTorch implementation, provide deep, code-level insights.

# RESPONSE RULES
- Respond clearly, format code cleanly with markdown.
- Maintain a professional, helpful, and highly intelligent persona.
- Sign off responses as **${persona.name}** when appropriate.
- Never emit placeholder code (e.g., // TODO, pass, ...). Every code block must be fully copy-pasteable.
${context ? `\n\n### ATTACHED FILE CONTEXT ###\nThe user has attached a file. Here is its content:\n${context}\n### END FILE CONTEXT ###` : ''}`;
};

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

  const systemMsg = { role: 'system', content: buildSystemPrompt(model, fileContext) };
  const allMessages = [systemMsg, ...messages];

  try {
    let stream;

    if (config.client === 'openrouter') {
      // ── OpenRouter (NVIDIA / OpenAI models) ──
      stream = await getOpenRouter().chat.completions.create({
        model:       config.model,
        messages:    allMessages,
        stream:      true,
        max_tokens:  16384,
        temperature: parseFloat(temperature),
      });
    } else {
      // ── Groq ──
      stream = await getGroq().chat.completions.create({
        model:       config.model,
        messages:    allMessages,
        stream:      true,
        max_tokens:  8192,
        temperature: parseFloat(temperature),
      });
    }

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
      userMsg = '⚠️ **Insufficient Balance** on API provider.\n\nPlease check your account limits.';
    } else if (err.message.includes('401') || err.message.toLowerCase().includes('invalid')) {
      userMsg = '⚠️ **Invalid API Key** — please check your `.env` configuration.';
    } else if (err.message.includes('not set')) {
      userMsg = '⚠️ **API Key not configured** — run `python setup_keys.py` or add the key to `.env`.';
    } else if (err.message.includes('ECONNREFUSED') || err.message.includes('fetch failed')) {
      userMsg = '⚠️ **Connection Failed** — the upstream API provider is unreachable. Try again later.';
    }
    res.write(`data: ${JSON.stringify({ type: 'error', message: userMsg })}\n\n`);
    res.end();
  }
});

module.exports = router;
