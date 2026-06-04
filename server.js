require('dotenv').config();
require('./utils/vault').decryptEnv(); // decrypt ENC: keys at startup
const express    = require('express');
const cors       = require('cors');
const path       = require('path');

const chatRoutes   = require('./routes/chat');
const memoryRoutes = require('./routes/memory');
const uploadRoutes = require('./routes/upload');
// n8n webhook proxied to Python
const { createProxyMiddleware } = require('http-proxy-middleware');

const app  = express();
const PORT = process.env.PORT || 3001;

// ── Middleware (CORS first) ───────────────────────────────────
app.use(cors());

// ── Python FastAPI Proxies (MUST be before body-parser) ──────
const pythonProxy = createProxyMiddleware({
  target: 'http://127.0.0.1:8001',
  changeOrigin: true,
});
app.use('/api/swarm', pythonProxy);
app.use('/api/chat', pythonProxy); 
app.use('/api/gemini-eval', pythonProxy);
app.use('/api/n8n/webhook', pythonProxy);

// ── Body Parsers ──────────────────────────────────────────────
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// ── Static frontend ───────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));

// ── Native API routes ─────────────────────────────────────────
app.use('/api/memory',       memoryRoutes);
app.use('/api/upload',       uploadRoutes);

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
