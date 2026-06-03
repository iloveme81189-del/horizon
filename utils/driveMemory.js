/**
 * driveMemory.js — Google Drive Chat Memory
 * Uses OAuth2 Web credentials (credentials.json) with a local token cache.
 *
 * First run: visit http://localhost:3001/api/memory/auth  to authorize
 * Subsequent runs: token auto-refreshes silently
 */

const { google }   = require('googleapis');
const path         = require('path');
const fs           = require('fs');

const CREDS_PATH   = path.join(__dirname, '..', 'credentials.json');
const TOKEN_PATH   = path.join(__dirname, '..', 'token.json');
const SCOPES       = ['https://www.googleapis.com/auth/drive'];

let _auth  = null;
let _drive = null;

// ── Build OAuth2 client ───────────────────────────────────────
function buildAuth() {
  if (_auth) return _auth;
  if (!fs.existsSync(CREDS_PATH)) throw new Error('credentials.json not found in D:\\TOOLS\\HORIZON\\');
  const { web } = JSON.parse(fs.readFileSync(CREDS_PATH, 'utf8'));
  _auth = new google.auth.OAuth2(web.client_id, web.client_secret, 'http://localhost:3001/api/memory/oauth2callback');
  if (fs.existsSync(TOKEN_PATH)) {
    _auth.setCredentials(JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8')));
  }
  _auth.on('tokens', tokens => {
    const existing = fs.existsSync(TOKEN_PATH) ? JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8')) : {};
    fs.writeFileSync(TOKEN_PATH, JSON.stringify({ ...existing, ...tokens }, null, 2));
  });
  return _auth;
}

function getDrive() {
  if (_drive) return _drive;
  _drive = google.drive({ version: 'v3', auth: buildAuth() });
  return _drive;
}

function getFolderId() {
  const id = process.env.GOOGLE_DRIVE_FOLDER_ID || '';
  if (!id || id.startsWith('your_')) throw new Error('GOOGLE_DRIVE_FOLDER_ID not set in .env');
  return id;
}

// ── Auth URL for first-time setup ────────────────────────────
function getAuthUrl() {
  return buildAuth().generateAuthUrl({ access_type: 'offline', scope: SCOPES, prompt: 'consent' });
}

async function exchangeCode(code) {
  const { tokens } = await buildAuth().getToken(code);
  buildAuth().setCredentials(tokens);
  fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));
}

// ── Is drive ready? ──────────────────────────────────────────
function isDriveConfigured() {
  return fs.existsSync(CREDS_PATH) &&
    fs.existsSync(TOKEN_PATH) &&
    !!process.env.GOOGLE_DRIVE_FOLDER_ID &&
    !process.env.GOOGLE_DRIVE_FOLDER_ID.startsWith('your_');
}

function isAuthPending() {
  return fs.existsSync(CREDS_PATH) && !fs.existsSync(TOKEN_PATH);
}

// ── List conversations ────────────────────────────────────────
async function listConversations() {
  const d = getDrive();
  const folderId = getFolderId();
  const res = await d.files.list({
    q: `'${folderId}' in parents and name contains 'horizon_chat_' and trashed=false`,
    fields: 'files(id,name,modifiedTime)',
    orderBy: 'modifiedTime desc',
    pageSize: 100,
  });
  return (res.data.files || []).map(f => ({
    fileId:   f.id,
    name:     f.name,
    cid:      f.name.replace('horizon_chat_', '').replace('.json', ''),
    modified: f.modifiedTime,
  }));
}

// ── Load one conversation ─────────────────────────────────────
async function loadConversation(cid) {
  const d = getDrive();
  const folderId = getFolderId();
  const res = await d.files.list({
    q: `'${folderId}' in parents and name='horizon_chat_${cid}.json' and trashed=false`,
    fields: 'files(id)',
  });
  const file = res.data.files?.[0];
  if (!file) return null;
  const content = await d.files.get({ fileId: file.id, alt: 'media' }, { responseType: 'text' });
  return JSON.parse(content.data);
}

// ── Save conversation ─────────────────────────────────────────
async function saveConversation(cid, title, messages) {
  const d = getDrive();
  const folderId = getFolderId();
  const fileName = `horizon_chat_${cid}.json`;
  const body = JSON.stringify({ cid, title, messages, savedAt: new Date().toISOString() });

  const res = await d.files.list({
    q: `'${folderId}' in parents and name='${fileName}' and trashed=false`,
    fields: 'files(id)',
  });
  const existing = res.data.files?.[0];

  if (existing) {
    await d.files.update({ fileId: existing.id, media: { mimeType: 'application/json', body } });
    return existing.id;
  } else {
    const created = await d.files.create({
      requestBody: { name: fileName, parents: [folderId], mimeType: 'application/json' },
      media: { mimeType: 'application/json', body },
    });
    return created.data.id;
  }
}

// ── Delete conversation ───────────────────────────────────────
async function deleteConversation(cid) {
  const d = getDrive();
  const folderId = getFolderId();
  const res = await d.files.list({
    q: `'${folderId}' in parents and name='horizon_chat_${cid}.json' and trashed=false`,
    fields: 'files(id)',
  });
  const file = res.data.files?.[0];
  if (file) await d.files.delete({ fileId: file.id });
}

module.exports = {
  isDriveConfigured, isAuthPending, getAuthUrl, exchangeCode,
  listConversations, loadConversation, saveConversation, deleteConversation,
};
