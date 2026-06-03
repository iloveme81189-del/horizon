# HorizonAI — Quick Start Guide

## 🔑 Step 1: Add Your API Keys

Open `.env` and paste your keys:

```env
DEEPSEEK_API_KEY=sk-xxxxxxxxxxxxxxxxxxxx
GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxx
```

## 🔒 Step 2: Generate Fernet Key (one-time)

```bash
python generate_fernet_key.py
```

## 🚀 Step 3: Run Locally

```bash
# Option A — Double-click
start.bat

# Option B — Terminal
node server.js
```
Open: http://localhost:3001

---

## 🌐 Get a Shareable Link (Access from Anywhere)

### Option 1: ngrok (Instant, free)

```bash
# Run in a SEPARATE terminal while server is running
share_link.bat
```
You'll get a URL like: `https://abc123.ngrok.io`
Share this link — anyone can access HorizonAI from any device.

> ⚠️ Free ngrok links expire after 8 hours. Run `share_link.bat` again to get a new one.

### Option 2: Render.com (Permanent, always-on, free)

1. Push this folder to GitHub:
   ```bash
   git init
   git add .
   git commit -m "HorizonAI v1.0"
   git remote add origin https://github.com/YOUR_USERNAME/horizon-ai.git
   git push -u origin main
   ```

2. Go to https://render.com → New → Web Service → Connect GitHub repo

3. In Render dashboard → Environment → Add:
   - `DEEPSEEK_API_KEY` = your key
   - `GROQ_API_KEY` = your key

4. Deploy → You get: `https://horizon-ai.onrender.com` ✅

---

## 🤖 Models Available

| Model | Provider | Best For |
|---|---|---|
| DeepSeek V3 | DeepSeek | Coding, analytics, general |
| DeepSeek R1 | DeepSeek | Step-by-step reasoning |
| Llama 3.3 70B | Groq | Fast, versatile |
| Mixtral 8x7B | Groq | Long context (32K) |
| Llama 3.1 8B | Groq | Instant responses |

## 📎 Supported File Types

PDF, Excel (.xlsx/.xls/.csv), Word (.docx), Images (.png/.jpg/.webp), Text/Code files
