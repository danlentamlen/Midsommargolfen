import { CFG } from './config.js';
import { escapeHtml } from './utils.js';
import { fetchWithTimeout } from './fetch.js';

// Ladda en extern bild-URL via fetch och returnera en blob-URL.
// Kringgår att tredjepartssajter blockerar <img src> via Referrer-Policy.
async function toBlobUrl(src) {
  try {
    const r = await fetch(src);
    if (!r.ok) return null;
    const blob = await r.blob();
    return URL.createObjectURL(blob);
  } catch {
    return null;
  }
}

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
            <img class="sponsor-logo" src="${imgSrc}" alt="${sNamn}" loading="lazy" decoding="async" onerror="this.closest('a').remove()">
          </a>`;
        }).join('');
        return;
      }
    } catch { /* Drive fetch misslyckades, fortsätt till CFG.sponsorer */ }
  }

  // -- Fallback: rendera sponsorer från CFG.sponsorer -----------
  if (sponsors.length) {
    // Bygg HTML med platshållare först (visar namn direkt)
    track.innerHTML = sponsors.map((s, i) =>
      `<a href="${escapeHtml(s.webbUrl||'#')}" target="_blank" rel="noopener" title="${escapeHtml(s.namn||'Sponsor')}" id="sp-link-${i}">
        <span class="sponsor-placeholder" id="sp-ph-${i}">${escapeHtml(s.namn||'Sponsor')}</span>
      </a>`
    ).join('');

    // Ladda sedan varje bild via fetch → blob, ersätt platshållaren
    sponsors.forEach(async (s, i) => {
      if (!s.logoUrl) return;
      const blobUrl = await toBlobUrl(s.logoUrl);
      const link = document.getElementById(`sp-link-${i}`);
      if (!link) return;
      if (blobUrl) {
        const img = document.createElement('img');
        img.className = 'sponsor-logo';
        img.src = blobUrl;
        img.alt = escapeHtml(s.namn || 'Sponsor');
        img.loading = 'lazy';
        img.decoding = 'async';
        img.onerror = () => { /* lämna kvar platshållaren om bilden ändå inte visas */ };
        const ph = document.getElementById(`sp-ph-${i}`);
        if (ph) ph.replaceWith(img);
      }
      // Om fetch misslyckas förblir platshållartexten synlig
    });
    return;
  }

  // -- Sista fallback: generiska platshållare -------------------
  track.innerHTML = Array.from({length: 4}, (_, i) =>
    `<div class="sponsor-placeholder">Sponsor ${i + 1}</div>`
  ).join('');
}
