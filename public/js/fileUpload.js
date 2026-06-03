/* ─────────────────────────────────────────
   fileUpload.js — drag-drop & client-side parsing
───────────────────────────────────────── */
const FileUpload = (() => {
  let attachedFile = null; // { fileName, type, content, imageData? }

  const btnAttach   = document.getElementById('btn-attach');
  const fileInput   = document.getElementById('file-input');
  const previewBar  = document.getElementById('file-preview-bar');
  const pillIcon    = document.getElementById('file-pill-icon');
  const pillName    = document.getElementById('file-pill-name');
  const btnRemove   = document.getElementById('btn-remove-file');
  const dropOverlay = document.getElementById('drop-overlay');

  const ICONS = { pdf:'📄', excel:'📊', word:'📝', image:'🖼️', text:'📃' };

  btnAttach.addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', e => {
    if (e.target.files[0]) handleFile(e.target.files[0]);
    fileInput.value = '';
  });

  btnRemove.addEventListener('click', clearFile);

  // Drag-drop
  ['dragenter','dragover'].forEach(ev => {
    document.addEventListener(ev, e => {
      if (e.dataTransfer.types.includes('Files')) {
        e.preventDefault();
        dropOverlay.classList.add('active');
      }
    });
  });
  ['dragleave','drop'].forEach(ev => {
    document.addEventListener(ev, e => {
      e.preventDefault();
      dropOverlay.classList.remove('active');
    });
  });
  document.addEventListener('drop', e => {
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  });

  async function handleFile(file) {
    showPill(file.name, '⏳');
    
    // Client-side parsing for CSV and Excel
    if (file.name.endsWith('.csv')) {
      return parseCSV(file);
    } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
      return parseExcel(file);
    }
    
    // Fallback to backend for PDF, Word, Images
    const fd = new FormData();
    fd.append('file', file);
    try {
      const res  = await fetch('/api/upload', { method: 'POST', body: fd });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      setFileContext(data);
    } catch (err) {
      clearFile();
      toast(`❌ ${err.message}`);
    }
  }

  // Parse CSV natively using PapaParse
  function parseCSV(file) {
    if (!window.Papa) return toast('❌ PapaParse not loaded');
    Papa.parse(file, {
      preview: 50, // Only first 50 rows
      header: true,
      skipEmptyLines: true,
      complete: function(results) {
        const content = "CSV Data (First 50 rows):\n" + JSON.stringify(results.data, null, 2);
        setFileContext({ fileName: file.name, type: 'excel', content });
      },
      error: function(err) {
        clearFile();
        toast(`❌ CSV Error: ${err.message}`);
      }
    });
  }

  // Parse Excel natively using SheetJS
  function parseExcel(file) {
    if (!window.XLSX) return toast('❌ SheetJS not loaded');
    const reader = new FileReader();
    reader.onload = function(e) {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Convert to JSON and take first 50 rows
        const json = XLSX.utils.sheet_to_json(worksheet);
        const preview = json.slice(0, 50);
        
        const content = `Excel Data - Sheet [${firstSheetName}] (First 50 rows):\n` + JSON.stringify(preview, null, 2);
        setFileContext({ fileName: file.name, type: 'excel', content });
      } catch (err) {
        clearFile();
        toast(`❌ Excel Error: ${err.message}`);
      }
    };
    reader.readAsArrayBuffer(file);
  }

  function setFileContext(data) {
    attachedFile = data;
    pillIcon.textContent = ICONS[data.type] || '📎';
    pillName.textContent = data.fileName;
    previewBar.style.display = 'flex';
    toast(`✅ ${data.fileName} loaded natively`);
  }

  function showPill(name, icon) {
    pillIcon.textContent = icon;
    pillName.textContent = name;
    previewBar.style.display = 'flex';
  }

  function clearFile() {
    attachedFile = null;
    previewBar.style.display = 'none';
  }

  function getFile()    { return attachedFile; }
  function hasFile()    { return attachedFile !== null; }

  return { getFile, hasFile, clearFile };
})();

function toast(msg, ms = 2800) {
  const t = document.createElement('div');
  t.className = 'error-toast'; // reusing the UI error boundary class
  t.style.position = 'fixed';
  t.style.bottom = '20px';
  t.style.right = '20px';
  t.style.zIndex = '9999';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 300); }, ms);
}
