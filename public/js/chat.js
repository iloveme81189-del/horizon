/* ─────────────────────────────────────────
   chat.js — messaging, streaming, markdown
───────────────────────────────────────── */
const Chat = (() => {
  let messages     = [];
  let currentCid   = genId();
  let streaming    = false;
  let currentModel = 'llama-3.3-70b-versatile';
  let driveEnabled = false;

  // Check Drive status once on load
  fetch('/api/memory/status').then(r => r.json()).then(d => {
    driveEnabled = d.configured;
    if (d.pendingAuth) {
      console.log('[Drive] Auth pending');
      showDriveAuthPrompt();
    } else if (driveEnabled) {
      console.log('[Drive] Memory enabled');
      loadDriveHistory();
    }
  }).catch(() => {});

  const messagesEl  = document.getElementById('messages');
  const welcomeEl   = document.getElementById('welcome-screen');
  const inputEl     = document.getElementById('user-input');
  const sendBtn     = document.getElementById('btn-send');
  const clearBtn    = document.getElementById('btn-clear');
  const exportBtn   = document.getElementById('btn-export');

  // ── Markdown renderer ──────────────────
  marked.setOptions({ breaks: true, gfm: true });
  const renderer = new marked.Renderer();
  renderer.code = (code, lang) => {
    const rawCode = typeof code === 'object' ? code.text : code;
    const safeCode = escHtml(rawCode);
    const safeLang = (typeof code === 'object' ? code.lang : lang) || 'plaintext';
    
    if (safeLang.toLowerCase() === 'plotly' || safeLang.toLowerCase() === 'json-plotly') {
      const chartId = 'chart-' + Math.random().toString(36).substr(2, 9);
      // Wait for DOM to insert before rendering
      setTimeout(() => renderPlotlyChart(chartId, rawCode), 500);
      return `<div id="${chartId}" class="chart-container"><div class="skeleton chart-skeleton"></div></div>`;
    }

    return `<div class="code-block-wrap">
      <div class="code-block-header">
        <span class="code-lang">${escHtml(safeLang)}</span>
        <div class="code-actions">
          <button class="copy-btn" onclick="copyCode(this)">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
            Copy
          </button>
        </div>
      </div>
      <pre><code class="language-${escHtml(safeLang)}">${safeCode}</code></pre>
    </div>`;
  };
  marked.use({ renderer });

  // ── Plotly Renderer ────────────────────
  function renderPlotlyChart(chartId, jsonStr) {
    if (!window.Plotly) return;
    const el = document.getElementById(chartId);
    if (!el) return;
    try {
      const config = JSON.parse(jsonStr);
      // clear skeleton
      el.innerHTML = '';
      Plotly.newPlot(el, config.data || config, config.layout || {}, { responsive: true });
    } catch (err) {
      el.innerHTML = `<div class="error-toast">❌ Chart Error: ${err.message}</div><pre><code>${escHtml(jsonStr)}</code></pre>`;
    }
  }

  // ── Smart Scrolling ────────────────────
  let userScrolledUp = false;
  const chatContainer = document.getElementById('chat-container');
  chatContainer.addEventListener('scroll', () => {
    const isAtBottom = chatContainer.scrollHeight - chatContainer.scrollTop <= chatContainer.clientHeight + 20;
    userScrolledUp = !isAtBottom;
  });

  function scrollToBottom() {
    if (!userScrolledUp) {
      chatContainer.scrollTo({ top: chatContainer.scrollHeight, behavior: 'auto' });
    }
  }

  function renderMarkdown(text) {
    const raw = marked.parse(text);
    return DOMPurify.sanitize(raw, { ADD_ATTR: ['onclick'] });
  }

  // ── Auto-resize textarea ───────────────
  inputEl.addEventListener('input', () => {
    inputEl.style.height = 'auto';
    inputEl.style.height = Math.min(inputEl.scrollHeight, 400) + 'px';
    sendBtn.disabled = !inputEl.value.trim() || streaming;
    const len = inputEl.value.length;
    document.getElementById('char-count').textContent = len > 100 ? `${len}` : '';
  });

  inputEl.addEventListener('keydown', e => {
    // Capture Ctrl+Enter or Cmd+Enter to send. Normal enter is new line.
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); sendMessage(); }
  });

  sendBtn.addEventListener('click', sendMessage);

  clearBtn.addEventListener('click', () => {
    if (!messages.length) return;
    if (confirm('Clear this conversation?')) newChat();
  });

  exportBtn.addEventListener('click', exportChat);

  // ── Suggestion cards ───────────────────
  document.querySelectorAll('.suggestion-card').forEach(card => {
    card.addEventListener('click', () => {
      inputEl.value = card.dataset.prompt;
      inputEl.dispatchEvent(new Event('input'));
      sendMessage();
    });
  });

  // ── Send ───────────────────────────────
  async function sendMessage() {
    const text = inputEl.value.trim();
    if (!text || streaming) return;

    const file = FileUpload.getFile();
    hideWelcome();

    // User message
    appendMessage('user', text, currentModel);
    messages.push({ role: 'user', content: text });

    // Reset input
    inputEl.value = '';
    inputEl.style.height = 'auto';
    sendBtn.disabled = true;
    streaming = true;
    sendBtn.classList.add('sending');

    // AI message placeholder
    const aiEl = appendMessage('ai', '', currentModel, true);
    const mdEl  = aiEl.querySelector('.md-content');
    const typEl = aiEl.querySelector('.typing-indicator');

    let fullText = '';

    // Check Swarm Mode
    const useSwarm = document.getElementById('swarm-toggle')?.checked;
    const endpoint = useSwarm ? '/api/swarm' : '/api/chat';

    try {
      const resp = await fetch(endpoint, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          messages,
          model:       currentModel,
          fileContext: file ? file.content : '',
        }),
      });

      if (!resp.ok) throw new Error(`Server error ${resp.status}`);

      const reader = resp.body.getReader();
      const dec    = new TextDecoder();
      typEl.style.display = 'none';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const lines = dec.decode(value).split('\n');
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const raw = line.slice(6).trim();
          if (!raw) continue;
          try {
            const evt = JSON.parse(raw);
            if (evt.type === 'delta') {
              fullText += evt.content;
              mdEl.innerHTML = renderMarkdown(fullText) + '<span class="streaming-cursor"></span>';
              scrollToBottom();
              if (window.MathJax) MathJax.typesetPromise([mdEl]).catch(()=>{});
            } else if (evt.type === 'done') {
              mdEl.innerHTML = renderMarkdown(fullText);
              highlightCode(mdEl);
              if (window.MathJax) MathJax.typesetPromise([mdEl]).catch(()=>{});
            } else if (evt.type === 'error') {
              throw new Error(evt.message);
            }
          } catch {}
        }
      }
    } catch (err) {
      mdEl.innerHTML = `<span style="color:var(--danger)">⚠️ ${escHtml(err.message)}</span>`;
      typEl.style.display = 'none';
    } finally {
      streaming = false;
      sendBtn.classList.remove('sending');
      sendBtn.disabled = !inputEl.value.trim();
      FileUpload.clearFile();
    }

    messages.push({ role: 'assistant', content: fullText });

    // Save to sidebar (localStorage)
    const title = messages[0]?.content?.slice(0, 50) || 'New Chat';
    Sidebar.addOrUpdate(currentCid, title, messages);

    // Auto-save to Google Drive
    if (driveEnabled && fullText) {
      fetch('/api/memory/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cid: currentCid, title, messages }),
      }).catch(e => console.warn('[Drive] Save failed:', e.message));
    }

    scrollToBottom();
  }

  // ── Append message bubble ──────────────
  function appendMessage(role, text, model, isStreaming = false) {
    const wrap = document.createElement('div');
    wrap.className = `message ${role}`;
    wrap.setAttribute('role', 'listitem');

    const avatar = role === 'ai'
      ? `<div class="message-avatar">H</div>`
      : `<div class="message-avatar">U</div>`;

    const modelLabel = MODEL_LABELS[model] || model;

    wrap.innerHTML = `
      ${avatar}
      <div class="message-content">
        ${role === 'ai' ? `<div class="message-meta"><span class="message-model-tag">${escHtml(modelLabel)}</span></div>` : ''}
        ${role === 'ai'
          ? `<div class="md-content">${isStreaming ? '' : renderMarkdown(text)}</div>
             ${isStreaming ? '<div class="typing-indicator"><div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div></div>' : ''}`
          : `<div>${escHtml(text)}</div>`}
      </div>`;

    messagesEl.appendChild(wrap);
    if (!isStreaming && role === 'ai') {
      highlightCode(wrap);
      if (window.MathJax) MathJax.typesetPromise([wrap]).catch(()=>{});
    }
    scrollToBottom();
    return wrap;
  }

  // ── Helpers ────────────────────────────
  function hideWelcome() {
    if (welcomeEl) welcomeEl.style.display = 'none';
  }

  function scrollToBottom() {
    const c = document.getElementById('chat-container');
    c.scrollTop = c.scrollHeight;
  }

  function highlightCode(el) {
    if (window.Prism) Prism.highlightAllUnder(el);
  }

  function newChat() {
    messages    = [];
    currentCid  = genId();
    messagesEl.innerHTML = '';
    if (welcomeEl) welcomeEl.style.display = 'flex';
    Sidebar.render(currentCid);
  }

  async function loadConversation(cid) {
    // Try Drive first, fallback to localStorage
    let chat = null;
    if (driveEnabled) {
      try {
        const res = await fetch(`/api/memory/${cid}`);
        if (res.ok) chat = await res.json();
      } catch {}
    }
    if (!chat) chat = Sidebar.get(cid);
    if (!chat) return;

    currentCid = cid;
    messages   = chat.messages || [];
    messagesEl.innerHTML = '';
    hideWelcome();
    messages.forEach(m => appendMessage(m.role, m.content, currentModel));
    Sidebar.render(cid);
    if (window.innerWidth <= 768) closeMobileSidebar();
  }

  // Load conversation list from Drive into sidebar
  async function loadDriveHistory() {
    try {
      const res   = await fetch('/api/memory/list');
      const data  = await res.json();
      if (!data.chats?.length) return;
      // Merge Drive chats into localStorage sidebar
      data.chats.forEach(c => {
        if (!Sidebar.get(c.cid)) {
          Sidebar.addOrUpdate(c.cid, c.name.replace('horizon_chat_','').replace('.json',''), []);
        }
      });
      // Re-render sidebar with Drive badge
      const driveEl = document.getElementById('drive-status');
      if (driveEl) driveEl.style.display = 'flex';
    } catch {}
  }

  function showDriveAuthPrompt() {
    const btn = document.createElement('a');
    btn.href = '/api/memory/auth';
    btn.className = 'drive-auth-btn';
    btn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
      </svg>
      Connect Google Drive
    `;
    btn.style.cssText = 'display:flex;align-items:center;gap:8px;padding:12px;margin:16px;background:var(--p);color:white;text-decoration:none;border-radius:var(--radius);justify-content:center;font-weight:500;';
    document.getElementById('sidebar').appendChild(btn);
  }

  function exportChat() {
    if (!messages.length) return toast('Nothing to export');
    const txt = messages.map(m => `[${m.role.toUpperCase()}]\n${m.content}`).join('\n\n---\n\n');
    const blob = new Blob([txt], { type: 'text/plain' });
    const a    = document.createElement('a');
    a.href     = URL.createObjectURL(blob);
    a.download = `HorizonAI_${new Date().toISOString().slice(0,10)}.txt`;
    a.click();
  }

  function setModel(id) { currentModel = id; }

  return { sendMessage, newChat, loadConversation, setModel };
})();

// Global helpers
function genId() { return 'cid_' + Date.now() + '_' + Math.random().toString(36).slice(2,7); }
function escHtml(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function copyCode(btn) {
  const code = btn.closest('.code-block-wrap').querySelector('code');
  navigator.clipboard.writeText(code.textContent).then(() => {
    btn.textContent = 'Copied!'; btn.classList.add('copied');
    setTimeout(() => { btn.textContent = 'Copy'; btn.classList.remove('copied'); }, 2000);
  });
}
const MODEL_LABELS = {};
function closeMobileSidebar() {
  document.getElementById('sidebar').classList.remove('mobile-open');
  document.getElementById('sidebar-overlay').classList.remove('active');
}
