/**
 * vault.js — Horizon API Key Decryption
 *
 * Supports two encryption formats stored in .env:
 *   FERNET:<token>  → encrypted by setup_keys.py (Python Fernet / AES-128-CBC)
 *   ENC:<token>     → encrypted by utils/vault.js CLI (AES-256-GCM)
 *
 * Call decryptEnv() once at server startup.
 */
const crypto = require('crypto');

const FERNET_PFX = 'FERNET:';
const AES_PFX    = 'ENC:';

// ── Fernet decryption (AES-128-CBC + HMAC-SHA256) ─────────────
function fernetDecrypt(token, fernetKey) {
  // Fernet key: URL-safe base64, 32 raw bytes (16 sign + 16 encrypt)
  const keyBuf   = Buffer.from(fernetKey.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
  const sigKey   = keyBuf.slice(0, 16);
  const encKey   = keyBuf.slice(16, 32);

  // Decode token (URL-safe base64)
  const raw      = Buffer.from(token.replace(/-/g, '+').replace(/_/g, '/'), 'base64');

  // raw layout: [0] version(1) | [1..8] timestamp(8) | [9..24] iv(16) | [25..N-32] ciphertext | [N-32..N] hmac(32)
  const hmacIn   = raw.slice(raw.length - 32);
  const hmacData = raw.slice(0, raw.length - 32);
  const expectedHmac = crypto.createHmac('sha256', sigKey).update(hmacData).digest();

  if (!crypto.timingSafeEqual(hmacIn, expectedHmac)) {
    throw new Error('Fernet HMAC verification failed — wrong FERNET_KEY?');
  }

  const iv         = raw.slice(9, 25);
  const ciphertext = raw.slice(25, raw.length - 32);

  const decipher = crypto.createDecipheriv('aes-128-cbc', encKey, iv);
  decipher.setAutoPadding(true);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

// ── AES-256-GCM decryption (legacy ENC: format) ───────────────
function aesDecrypt(encValue, masterKey) {
  const buf  = Buffer.from(encValue.slice(AES_PFX.length), 'base64');
  const key  = crypto.scryptSync(masterKey, 'horizon_salt_v1', 32);
  const iv   = buf.slice(0, 12);
  const tag  = buf.slice(12, 28);
  const enc  = buf.slice(28);
  const d    = crypto.createDecipheriv('aes-256-gcm', key, iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(enc), d.final()]).toString('utf8');
}

// ── Decrypt all protected API keys in process.env ─────────────
function decryptEnv() {
  const fernetKey = process.env.FERNET_KEY;
  const masterKey = process.env.MASTER_KEY;
  const keys      = ['DEEPSEEK_API_KEY', 'GROQ_API_KEY'];

  keys.forEach(k => {
    const val = process.env[k] || '';
    try {
      if (val.startsWith(FERNET_PFX) && fernetKey && !fernetKey.startsWith('your_')) {
        process.env[k] = fernetDecrypt(val.slice(FERNET_PFX.length), fernetKey);
        console.log(`[Vault] ✅  ${k} decrypted (Fernet)`);
      } else if (val.startsWith(AES_PFX) && masterKey && !masterKey.startsWith('your_')) {
        process.env[k] = aesDecrypt(val, masterKey);
        console.log(`[Vault] ✅  ${k} decrypted (AES-256)`);
      }
    } catch (err) {
      console.error(`[Vault] ❌  Failed to decrypt ${k}: ${err.message}`);
    }
  });
}

module.exports = { decryptEnv, fernetDecrypt, aesDecrypt };
