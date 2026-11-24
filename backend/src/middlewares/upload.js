/* File uploads are held in memory (they are parsed or stored straight away). */
const multer = require('multer');
const config = require('../config');

const memory = (maxBytes) => multer({ storage: multer.memoryStorage(), limits: { fileSize: maxBytes } });

module.exports = {
  /* PMO workbook (.xlsx) */
  workbook: memory(config.uploads.workbookMaxBytes).single('file'),
  /* timesheets and quality report documents */
  document: memory(config.uploads.fileMaxBytes).single('file')
};
