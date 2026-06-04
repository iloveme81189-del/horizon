require('dotenv').config();
require('./utils/vault').decryptEnv(); // decrypt ENC: keys at startup
const express    = require('express');
const cors       = require('cors');
const path       = require('path');

const chatRoutes   = require('./routes/chat');
const memoryRoutes = require('./routes/memory');
const uploadRoutes = require('./routes/upload');
const n8nRoutes    = require('./routes/n8n');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app  = express();
const PORT = process.env.PORT || 3001;

// ── Middleware ────────────────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// ── Static frontend ───────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));

// ── API routes ────────────────────────────────────────────────
// app.use('/api/chat',         chatRoutes); // Replaced by Python proxy
app.use('/api/memory',       memoryRoutes);
app.use('/api/upload',       uploadRoutes);   // Native Node.js file upload (PDF, Excel, Word, Images)
app.use('/api/n8n/webhook',  n8nRoutes);      // n8n automation webhook

// ── Python FastAPI Proxies (LLM Router & Memory) ────────────
const pythonProxy = createProxyMiddleware({
  target: 'http://127.0.0.1:8001',
  changeOrigin: true,
});
app.use('/api/swarm', pythonProxy);
app.use('/api/chat', pythonProxy); // Route all chat directly to Python
app.use('/api/gemini-eval', pythonProxy);

// ── Health check ──────────────────────────────────────────────
app.get('/health', (_req, res) =>
  res.json({ status: 'ok', version: process.env.APP_VERSION || '1.0.0', uptime: process.uptime() })
);

// ── Models list (for frontend dynamic loading) ─────────────────
app.get('/api/models', (_req, res) => {
  res.json({
    groups: [
      {
        id: 'groq',
        label: 'Groq',
        icon: '⚡',
        models: [
          { id: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B',   tag: 'Fast',    desc: 'Horizon Rapid — ultra-fast versatile coding' },
          { id: 'mixtral-8x7b-32768',      label: 'Mixtral 8x7B',    tag: 'Long',    desc: 'Horizon Deep — 32K context document analysis' },
          { id: 'llama-3.1-8b-instant',    label: 'Llama 3.1 8B',    tag: 'Instant', desc: 'Horizon Flash — fastest responses' }
        ]
      },
      {
        id: 'nvidia',
        label: 'NVIDIA',
        icon: '🟢',
        models: [
          { id: 'nvidia/nemotron-3-ultra-550b', label: 'Nemotron-3 Ultra 550B', tag: 'Architect', desc: 'Horizon Architect — enterprise system design & GPU computing' }
        ]
      },
      {
        id: 'openai',
        label: 'OpenAI',
        icon: '🧠',
        models: [
          { id: 'openai/gpt-oss-120b', label: 'GPT-OSS 120B', tag: 'Sovereign', desc: 'Horizon Sovereign — deep reasoning & agentic problem solving' }
        ]
      }
    ]
  });
});

// ── SPA fallback ──────────────────────────────────────────────
app.get('*', (_req, res) =>
  res.sendFile(path.join(__dirname, 'public', 'index.html'))
);

// ── Start ─────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log('\n╔══════════════════════════════════════╗');
  console.log('║       🚀  HorizonAI  v2.0.0          ║');
  console.log('╠══════════════════════════════════════╣');
  console.log(`║  Local:   http://localhost:${PORT}      ║`);
  console.log('║  Status:  RUNNING                    ║');
  console.log('║  Upload:  Node.js (native)           ║');
  console.log('║  n8n:     /api/n8n/webhook            ║');
  console.log('╚══════════════════════════════════════╝\n');
});
