/* ─────────────────────────────────────────
   app.js — bootstrap, model selector, theme, sidebar
───────────────────────────────────────── */

// ── GEMINI-STYLE GREETING ──────────────────
(function setGreeting() {
  const h = new Date().getHours();
  let greet = 'What can I help with?';
  if      (h >= 5  && h < 12) greet = 'Good morning! What can I help with?';
  else if (h >= 12 && h < 17) greet = 'Good afternoon! What can I help with?';
  else if (h >= 17 && h < 21) greet = 'Good evening! What can I help with?';
  else                         greet = "Let's get to work. What can I help with?";
  const el = document.getElementById('welcome-greeting');
  if (el) el.textContent = greet;
})();

// ── MODEL POPUP ────────────────────────────
let selectedModel     = 'llama-3.3-70b-versatile';
let modelsData        = [];
const MODEL_DOT_COLORS = { deepseek: '#FF8C00', groq: '#a855f7' };

const modelPopup  = document.getElementById('model-popup');
const modelBtn    = document.getElementById('btn-model-select');
const modelLabel  = document.getElementById('model-select-label');
const modelDot    = document.getElementById('model-dot');

async function loadModels() {
  try {
    const res  = await fetch('/api/models');
    const data = await res.json();
    modelsData = data.groups;
    buildModelPopup(data.groups);
    data.groups.forEach(g => g.models.forEach(m => { MODEL_LABELS[m.id] = m.label; }));
    setModel('llama-3.3-70b-versatile');
  } catch (e) {
    console.warn('Could not load models:', e.message);
  }
}

function buildModelPopup(groups) {
  const content = document.getElementById('model-popup-content');
  content.innerHTML = groups.map(g => `
    <div class="model-group">
      <div class="model-group-label"><span>${g.icon}</span><span>${escHtml(g.label)}</span></div>
      ${g.models.map(m => `
        <div class="model-option ${m.id === selectedModel ? 'selected' : ''}"
             data-id="${escHtml(m.id)}" data-provider="${escHtml(g.id)}"
             role="option" aria-selected="${m.id === selectedModel}" tabindex="0">
          <div class="model-option-left">
            <div class="model-option-name">${escHtml(m.label)}<span class="model-tag">${escHtml(m.tag)}</span></div>
            <div class="model-option-desc">${escHtml(m.desc)}</div>
          </div>
          <svg class="model-check" width="16" height="16" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="2.5"
               style="${m.id === selectedModel ? '' : 'visibility:hidden'}">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        </div>`).join('')}
    </div>`).join('');

  content.querySelectorAll('.model-option').forEach(opt => {
    opt.addEventListener('click', () => { setModel(opt.dataset.id, opt.dataset.provider); closeModelPopup(); });
    opt.addEventListener('keydown', e => { if (e.key === 'Enter') opt.click(); });
  });
}

function setModel(id, provider) {
  selectedModel = id;
  Chat.setModel(id);
  const allModels = modelsData.flatMap(g => g.models.map(m => ({ ...m, provider: g.id })));
  const found = allModels.find(m => m.id === id);
  if (found) {
    modelLabel.textContent = found.label;
    modelDot.style.background = MODEL_DOT_COLORS[found.provider || 'deepseek'] || '#FF8C00';
  }
  if (modelsData.length) buildModelPopup(modelsData);
}

modelBtn.addEventListener('click', e => {
  e.stopPropagation();
  modelPopup.style.display === 'block' ? closeModelPopup() : openModelPopup();
});

function openModelPopup() {
  const rect = modelBtn.getBoundingClientRect();
  modelPopup.style.display = 'block';
  const popH = modelPopup.offsetHeight || 320;
  modelPopup.style.left = rect.left + 'px';
  modelPopup.style.top  = (rect.top - popH - 8) + 'px';
  modelBtn.setAttribute('aria-expanded', 'true');
}
function closeModelPopup() {
  modelPopup.style.display = 'none';
  modelBtn.setAttribute('aria-expanded', 'false');
}
document.addEventListener('click', e => {
  if (!modelPopup.contains(e.target) && e.target !== modelBtn) closeModelPopup();
});
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModelPopup(); });

// ── SIDEBAR TOGGLE ─────────────────────────
const sidebar        = document.getElementById('sidebar');
const openBtn        = document.getElementById('btn-open-sidebar');
const toggleBtn      = document.getElementById('btn-toggle-sidebar');

function openSidebar() {
  sidebar.classList.remove('collapsed');
  openBtn.style.display = 'none';
}
function closeSidebar() {
  sidebar.classList.add('collapsed');
  openBtn.style.display = 'flex';
}

toggleBtn.addEventListener('click', () => {
  sidebar.classList.contains('collapsed') ? openSidebar() : closeSidebar();
});
openBtn.addEventListener('click', openSidebar);

// Mobile
document.getElementById('btn-sidebar-mobile').addEventListener('click', () => {
  sidebar.classList.add('mobile-open');
  document.getElementById('sidebar-overlay').classList.add('active');
});
document.getElementById('sidebar-overlay').addEventListener('click', closeMobileSidebar);

// ── NEW CHAT ───────────────────────────────
document.getElementById('btn-new-chat').addEventListener('click', () => {
  Chat.newChat();
  if (window.innerWidth <= 768) closeMobileSidebar();
});

// ── THEME ──────────────────────────────────
const themeBtn = document.getElementById('btn-theme');
const sunIcon  = document.getElementById('theme-icon-sun');
const moonIcon = document.getElementById('theme-icon-moon');
let isDark = localStorage.getItem('horizon_theme') !== 'light'; // default dark

function applyTheme(dark) {
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  sunIcon.style.display  = dark ? 'none'  : 'block';
  moonIcon.style.display = dark ? 'block' : 'none';
  localStorage.setItem('horizon_theme', dark ? 'dark' : 'light');
}
themeBtn.addEventListener('click', () => { isDark = !isDark; applyTheme(isDark); });
applyTheme(isDark);

// ── INIT ───────────────────────────────────
Sidebar.render(null);
loadModels();
