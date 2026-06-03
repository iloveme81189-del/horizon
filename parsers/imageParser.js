/**
 * Convert image buffer to base64 string for DeepSeek Vision API.
 * @param {Buffer} buffer
 * @param {string} mimeType
 * @returns {string} base64 string
 */
module.exports = function parseImage(buffer, mimeType) {
  return buffer.toString('base64');
};
