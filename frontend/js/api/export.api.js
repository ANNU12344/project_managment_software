/* Excel status packs built by the server.  Backend: routes/export.routes.js
 * Each returns { blob, filename }; pass it to core/download.js to save it. */
import { getFile } from './client.js';

export const downloadPortfolioPack = () => getFile('/export/portfolio.xlsx');
export const downloadProjectPack = (projectId) => getFile(`/export/project/${encodeURIComponent(projectId)}.xlsx`);
