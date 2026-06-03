const XLSX = require('xlsx');

/**
 * Convert Excel/CSV buffer to readable markdown tables.
 * @param {Buffer} buffer
 * @param {string} ext - file extension
 * @returns {string}
 */
module.exports = function parseExcel(buffer, ext) {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  let output = `📊 Excel/CSV File — ${workbook.SheetNames.length} sheet(s)\n${'─'.repeat(60)}\n\n`;

  workbook.SheetNames.forEach(sheetName => {
    const sheet = workbook.Sheets[sheetName];
    const json  = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    if (json.length === 0) {
      output += `### Sheet: ${sheetName}\n*(empty)*\n\n`;
      return;
    }

    const headers = Object.keys(json[0]);
    const rows    = json.slice(0, 200); // cap at 200 rows for context

    output += `### Sheet: ${sheetName} (${json.length} rows × ${headers.length} cols)\n\n`;

    // Markdown table header
    output += '| ' + headers.join(' | ') + ' |\n';
    output += '| ' + headers.map(() => '---').join(' | ') + ' |\n';

    rows.forEach(row => {
      output += '| ' + headers.map(h => String(row[h] ?? '').replace(/\|/g, '\\|')).join(' | ') + ' |\n';
    });

    if (json.length > 200) {
      output += `\n> ⚠️ Showing 200 of ${json.length} rows. Ask me to analyze specific columns.\n`;
    }
    output += '\n\n';
  });

  return output;
};
