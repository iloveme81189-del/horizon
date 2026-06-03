const express = require('express');
const router  = express.Router();
const drive   = require('../utils/driveMemory');

// ── GET /api/memory/status — check if Drive is configured ────
router.get('/status', (_req, res) => {
  res.json({
    configured: drive.isDriveConfigured(),
    pendingAuth: drive.isAuthPending()
  });
});

// ── GET /api/memory/auth — trigger OAuth flow ────────────────
router.get('/auth', (req, res) => {
  try {
    res.redirect(drive.getAuthUrl());
  } catch (e) {
    res.status(500).send('Auth failed: ' + e.message);
  }
});

// ── GET /api/memory/oauth2callback — handle Google redirect ──
router.get('/oauth2callback', async (req, res) => {
  const code = req.query.code;
  if (!code) return res.send('No code provided');
  try {
    await drive.exchangeCode(code);
    res.send(`
      <html><body>
      <h2>✅ Google Drive Connected!</h2>
      <p>Horizon can now save memory to your Drive.</p>
      <script>setTimeout(() => window.location.href='/', 2000);</script>
      </body></html>
    `);
  } catch (e) {
    res.status(500).send('Token exchange failed: ' + e.message);
  }
});

// ── GET /api/memory/list — all saved conversations ────────────
router.get('/list', async (_req, res) => {
  if (!drive.isDriveConfigured()) return res.json({ chats: [], configured: false });
  try {
    const chats = await drive.listConversations();
    res.json({ chats, configured: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── GET /api/memory/:cid — load one conversation ──────────────
router.get('/:cid', async (req, res) => {
  try {
    const data = await drive.loadConversation(req.params.cid);
    if (!data) return res.status(404).json({ error: 'Not found' });
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── POST /api/memory/save — save a conversation ───────────────
router.post('/save', async (req, res) => {
  if (!drive.isDriveConfigured()) return res.json({ ok: false, reason: 'Drive not configured' });
  const { cid, title, messages } = req.body;
  if (!cid || !messages) return res.status(400).json({ error: 'Missing cid or messages' });
  try {
    const fileId = await drive.saveConversation(cid, title || 'Untitled', messages);
    res.json({ ok: true, fileId });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── DELETE /api/memory/:cid ───────────────────────────────────
router.delete('/:cid', async (req, res) => {
  try {
    await drive.deleteConversation(req.params.cid);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
