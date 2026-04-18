import { CFG } from './config.js';
import { escapeHtml } from './utils.js';
import { fetchWithTimeout } from './fetch.js';

export async function loadSponsors() {
  const track = document.getElementById('sponsor-track');
  let sponsors = CFG.sponsorer || [];

  // -- Försök hämta sponsorer från Google Drive -----------------
  if (CFG.driveSponsorFolderId && CFG.appsScriptUrl) {
    try {
      const r = await fetchWithTimeout(CFG.appsScriptUrl + '?action=sponsorbilder&folderId=' + encodeURIComponent(CFG.driveSponsorFolderId));
      const d = await r.json();
      if (d && d.length) {
        track.innerHTML = d.map((s, i) => {
          const sNamn = escapeHtml(s.namn || 'Sponsor ' + (i + 1));
          const imgSrc = s.base64 ? `data:${s.mimeType||'image/png'};base64,${s.base64}` : s.url;
          return `<a href="${escapeHtml(s.webb||'#')}" target="_blank" rel="noopener" title="${sNamn}">
            <img class="sponsor-logo" src="${imgSrc}" alt="${sNamn}" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.closest('a').remove()">
          </a>`;
        }).join('');
        return;
      }
    } catch { /* Drive fetch misslyckades, fortsätt till CFG.sponsorer */ }
  }

  // -- Fallback: rendera sponsorer från CFG.sponsorer -----------
  if (sponsors.length) {
    track.innerHTML = sponsors.map(s => {
      const sNamn = escapeHtml(s.namn || 'Sponsor');
      return `<a href="${escapeHtml(s.webbUrl||'#')}" target="_blank" rel="noopener" title="${sNamn}">
        <img class="sponsor-logo" src="${s.logoUrl}" alt="${sNamn}" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.closest('a').remove()">
      </a>`;
    }).join('');
    return;
  }

  // -- Sista fallback: generiska platshållare -------------------
  track.innerHTML = Array.from({length: 4}, (_, i) =>
    `<div class="sponsor-placeholder">Sponsor ${i + 1}</div>`
  ).join('');
}
