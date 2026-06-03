require('dotenv').config();
require('./utils/vault').decryptEnv(); // decrypt ENC: keys at startup
const express    = require('express');
const cors       = require('cors');
const path       = require('path');

const chatRoutes   = require('./routes/chat');
const memoryRoutes = require('./routes/memory');
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
app.use('/api/chat',   chatRoutes);
app.use('/api/memory', memoryRoutes);

// ── Python Flask Proxies ──────────────────────────────────────
const pythonProxy = createProxyMiddleware({
  target: 'http://127.0.0.1:8001',
  changeOrigin: true,
});
app.use('/api/upload', pythonProxy);
app.use('/api/swarm', pythonProxy);

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
          { id: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B',   tag: 'Fast',    desc: 'Ultra-fast versatile model' },
          { id: 'mixtral-8x7b-32768',      label: 'Mixtral 8x7B',    tag: 'Long',    desc: '32K context window' },
          { id: 'llama-3.1-8b-instant',    label: 'Llama 3.1 8B',    tag: 'Instant', desc: 'Fastest responses' }
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
  console.log('║       🚀  HorizonAI  v1.0.0          ║');
  console.log('╠══════════════════════════════════════╣');
  console.log(`║  Local:   http://localhost:${PORT}      ║`);
  console.log('║  Status:  RUNNING                    ║');
  console.log('╚══════════════════════════════════════╝\n');
});
