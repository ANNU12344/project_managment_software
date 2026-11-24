/* Response helpers shared by controllers. */
const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const safeFilename = name => String(name).replace(/[^\w.\- ]+/g, '_');

function sendXlsx(res, name, buf) {
  res.setHeader('Content-Type', XLSX_MIME);
  res.setHeader('Content-Disposition', `attachment; filename="${safeFilename(name)}"`);
  res.send(buf);
}

function sendFile(res, { name, mime, data }) {
  res.setHeader('Content-Type', mime || 'application/octet-stream');
  res.setHeader('Content-Disposition', `attachment; filename="${safeFilename(name)}"`);
  res.send(Buffer.from(data));
}

module.exports = { XLSX_MIME, sendXlsx, sendFile, safeFilename };
