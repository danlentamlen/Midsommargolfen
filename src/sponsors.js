import { CFG } from './config.js';
import { escapeHtml } from './utils.js';
import { fetchWithTimeout } from './fetch.js';

// Sätter innerHTML på sponsor-track med duplicerat innehåll för sömlös loop
function renderTrack(html) {
  const track = document.getElementById('sponsor-track');
  track.innerHTML = `<div class="sponsor-track-inner">${html}${html}</div>`;
}

export async function loadSponsors() {
  const sponsors = CFG.sponsorer || [];

  // -- Försök hämta sponsorer från Google Drive -----------------
  if (CFG.driveSponsorFolderId && CFG.appsScriptUrl) {
    try {
      const r = await fetchWithTimeout(CFG.appsScriptUrl + '?action=sponsorbilder&folderId=' + encodeURIComponent(CFG.driveSponsorFolderId));
      const d = await r.json();
      if (d && d.length) {
        const html = d.map((s, i) => {
          const sNamn = escapeHtml(s.namn || 'Sponsor ' + (i + 1));
          const imgSrc = s.base64 ? `data:${s.mimeType||'image/png'};base64,${s.base64}` : s.url;
          return `<a href="${escapeHtml(s.webb||'#')}" target="_blank" rel="noopener" title="${sNamn}">
            <img class="sponsor-logo" src="${imgSrc}" alt="${sNamn}" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.closest('a')?.remove()">
          </a>`;
        }).join('');
        renderTrack(html);
        return;
      }
    } catch { /* Drive fetch misslyckades, fortsätt */ }
  }

  // -- Fallback: CFG.sponsorer — ladda via fetch → blob --------
  if (sponsors.length) {
    // 1. Ladda alla bilder parallellt via fetch → blob-URL
    const blobUrls = await Promise.all(sponsors.map(async (s) => {
      if (!s.logoUrl) return null;
      try {
        const r = await fetch(s.logoUrl);
        if (!r.ok) return null;
        const blob = await r.blob();
        return URL.createObjectURL(blob);
      } catch { return null; }
    }));

    // 2. Bygg HTML — bild om blob lyckades, annars platshållartext
    const html = sponsors.map((s, i) => {
      const sNamn = escapeHtml(s.namn || 'Sponsor');
      const href  = escapeHtml(s.webbUrl || '#');
      if (blobUrls[i]) {
        return `<a href="${href}" target="_blank" rel="noopener" title="${sNamn}">
          <img class="sponsor-logo" src="${blobUrls[i]}" alt="${sNamn}" loading="lazy" decoding="async">
        </a>`;
      }
      return `<a href="${href}" target="_blank" rel="noopener" title="${sNamn}">
        <span class="sponsor-placeholder">${sNamn}</span>
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