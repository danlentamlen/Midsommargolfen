import { CFG } from './config.js';
import { escapeHtml } from './utils.js';
import { fetchWithTimeout } from './fetch.js';

function renderTrack(html) {
  const track = document.getElementById('sponsor-track');
  track.innerHTML = `<div class="sponsor-track-inner">${html}${html}</div>`;
}

export async function loadSponsors() {
  const sponsors = CFG.sponsorer || [];

  // -- Hämta sponsorloggor från Google Drive --------------------
  // Apps Script returnerar: [{ namn, base64, mimeType, webb }, ...]
  if (CFG.driveSponsorFolderId && CFG.appsScriptUrl) {
    try {
      const r = await fetchWithTimeout(
        CFG.appsScriptUrl + '?action=sponsorbilder&folderId=' + encodeURIComponent(CFG.driveSponsorFolderId)
      );
      const d = await r.json();
      if (d && d.length) {
        const html = d.map((s, i) => {
          const sNamn  = escapeHtml(s.namn || 'Sponsor ' + (i + 1));
          const href   = escapeHtml(s.webb || '#');
          const imgSrc = s.base64
            ? `data:${s.mimeType || 'image/png'};base64,${s.base64}`
            : (s.url || '');
          return `<a href="${href}" target="_blank" rel="noopener" title="${sNamn}">
            <img class="sponsor-logo" src="${imgSrc}" alt="${sNamn}" loading="lazy" decoding="async" onerror="this.closest('a')?.remove()">
          </a>`;
        }).join('');
        renderTrack(html);
        return;
      }
    } catch (e) {
      console.warn('loadSponsors: Drive fetch misslyckades, faller tillbaka på CFG.sponsorer', e);
    }
  }

  // -- Fallback: lokala loggor från CFG.sponsorer (/public/logos/)
  if (sponsors.length) {
    const html = sponsors.map(s => {
      const sNamn = escapeHtml(s.namn || 'Sponsor');
      const href  = escapeHtml(s.webbUrl || '#');
      return `<a href="${href}" target="_blank" rel="noopener" title="${sNamn}">
        <img class="sponsor-logo" src="${s.logoUrl}" alt="${sNamn}" loading="lazy" decoding="async" onerror="this.closest('a')?.remove()">
      </a>`;
    }).join('');
    renderTrack(html);
    return;
  }

  // -- Sista fallback: generiska platshållare ------------------
  const html = Array.from({length: 4}, (_, i) =>
    `<div class="sponsor-placeholder">Sponsor ${i + 1}</div>`
  ).join('');
  renderTrack(html);
}