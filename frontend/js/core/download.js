/* Save a server-built file (Excel pack, template, stored document) through the browser.
 *
 *   download(() => downloadPortfolioPack(), 'portfolio.xlsx')
 *
 * `fetcher` is one of the getFile-based functions in js/api/*.api.js; it returns { blob, filename }.
 * The server's filename wins; fallbackName is used only when the server sends none.
 */
import { toast } from '../components/toast.js';
import { errorMessage } from '../api/client.js';

export async function download(fetcher, fallbackName) {
  toast('Preparing download…');
  try {
    const { blob, filename } = await fetcher();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename || fallbackName;
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 0);
    toast(a.download + ' downloaded');
  } catch (e) {
    if (e.status === 401) return;                     // the login screen is already showing
    toast(errorMessage(e, 'Could not prepare that download'), true);
  }
}
