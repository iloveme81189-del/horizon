/* ─────────────────────────────────────────
   sidebar.js  — conversation history
───────────────────────────────────────── */
const Sidebar = (() => {
  const KEY = 'horizon_chats';

  function load() {
    try { return JSON.parse(localStorage.getItem(KEY)) || []; }
    catch { return []; }
  }
  
  function save(list) {
    localStorage.setItem(KEY, JSON.stringify(list));
  }

  function render(activeCid) {
    const list = load();
    const el   = document.getElementById('chat-history');
    el.innerHTML = '';
    
    if (!list.length) {
      el.innerHTML = '<div style="padding:12px 10px;font-size:13px;color:var(--text-muted)">No previous chats</div>';
      return;
    }

    // Sort by descending timestamp
    const sorted = list.slice().sort((a, b) => b.ts - a.ts);
    
    const now = Date.now();
    const groups = { 'Today': [], 'Yesterday': [], 'Previous 7 Days': [], 'Older': [] };

    sorted.forEach(c => {
      const diffDays = (now - c.ts) / (1000 * 60 * 60 * 24);
      if (diffDays < 1) groups['Today'].push(c);
      else if (diffDays < 2) groups['Yesterday'].push(c);
      else if (diffDays <= 7) groups['Previous 7 Days'].push(c);
      else groups['Older'].push(c);
    });

    Object.entries(groups).forEach(([label, chats]) => {
      if (!chats.length) return;
      
      const header = document.createElement('div');
      header.className = 'sidebar-section-label';
      header.textContent = label;
      el.appendChild(header);

      chats.forEach(c => {
        const item = document.createElement('div');
        item.className = 'history-item' + (c.id === activeCid ? ' active' : '');
        item.setAttribute('role', 'listitem');
        item.innerHTML = `
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
          </svg>
          <span>${escHtml(c.title)}</span>`;
        item.addEventListener('click', () => window.Chat && Chat.loadConversation(c.id));
        el.appendChild(item);
      });
    });
  }

  function addOrUpdate(cid, title, messages) {
    const list = load();
    const idx  = list.findIndex(c => c.id === cid);
    if (idx >= 0) { list[idx] = { id: cid, title, messages, ts: Date.now() }; }
    else { list.push({ id: cid, title, messages, ts: Date.now() }); }
    save(list);
    render(cid);
  }

  function get(cid) { return load().find(c => c.id === cid) || null; }

  function escHtml(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  return { load, render, addOrUpdate, get };
})();
