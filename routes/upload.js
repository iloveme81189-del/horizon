const express = require('express');
const router  = express.Router();
const multer  = require('multer');
const path    = require('path');

const parsePDF   = require('../parsers/pdfParser');
const parseExcel = require('../parsers/excelParser');
const parseWord  = require('../parsers/wordParser');
const parseImage = require('../parsers/imageParser');

// Memory storage — no files saved to disk
const storage = multer.memoryStorage();
const upload  = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
});

router.post('/', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file received.' });

    const { originalname, buffer, mimetype } = req.file;
    const ext = path.extname(originalname).toLowerCase();

    let result = { fileName: originalname, type: 'text', content: '' };

    // Handle standard text-based files immediately
    if (['.txt', '.md', '.json', '.xml', '.html', '.css', '.js', '.sql'].includes(ext)) {
      result.content = buffer.toString('utf8');
      result.type    = 'text';
    } 
    // Handle images with base64
    else if (['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp'].includes(ext)) {
      const base64 = parseImage(buffer, mimetype);
      result.type     = 'image';
      result.content  = `[Image uploaded: ${originalname}]`;
      result.imageData = { base64, mimeType: mimetype };
    } 
    // For PDFs, Word, Excel, use Microsoft MarkItDown via Python
    else {
      const { spawn } = require('child_process');
      const fs = require('fs');
      const os = require('os');
      
      const tmpPath = path.join(os.tmpdir(), `temp_${Date.now()}${ext}`);
      fs.writeFileSync(tmpPath, buffer);
      
      result.content = await new Promise((resolve, reject) => {
        const pyPath = path.join(__dirname, '../utils/markitdown_parser.py');
        const pythonProcess = spawn('python', [pyPath, tmpPath]);
        
        let outData = '';
        let errData = '';
        
        pythonProcess.stdout.on('data', (data) => { outData += data.toString(); });
        pythonProcess.stderr.on('data', (data) => { errData += data.toString(); });
        
        pythonProcess.on('close', (code) => {
          fs.unlinkSync(tmpPath); // Cleanup
          try {
            const parsed = JSON.parse(outData);
            if (parsed.success) {
              resolve(parsed.markdown);
            } else {
              reject(new Error(parsed.error || errData || "Python error"));
            }
          } catch (e) {
            reject(new Error("Failed to parse Python output: " + outData));
          }
        });
      });
      result.type = ext === '.pdf' ? 'pdf' : (ext.includes('xls') ? 'excel' : 'word');
    }

    // Limit context size to ~50K chars
    if (result.content.length > 50000) {
      result.content  = result.content.substring(0, 50000);
      result.truncated = true;
    }

    res.json({ success: true, ...result });

  } catch (err) {
    console.error('[Upload Error]', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
