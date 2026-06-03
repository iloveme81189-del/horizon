const mammoth = require('mammoth');

/**
 * Extract clean text from a Word .docx buffer.
 * @param {Buffer} buffer
 * @returns {Promise<string>}
 */
module.exports = async function parseWord(buffer) {
  const result = await mammoth.extractRawText({ buffer });
  return [
    '📝 Word Document',
    '─'.repeat(60),
    result.value.trim()
  ].join('\n');
};
