const pdfParse = require('pdf-parse');

/**
 * Extract all text from a PDF buffer.
 * @param {Buffer} buffer
 * @returns {Promise<string>}
 */
module.exports = async function parsePDF(buffer) {
  const data = await pdfParse(buffer);
  return [
    `📄 PDF Document — ${data.numpages} page(s)`,
    '─'.repeat(60),
    data.text.trim()
  ].join('\n');
};
