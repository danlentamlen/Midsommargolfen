import { CFG } from './config.js';
import { escapeHtml } from './utils.js';
import { fetchWithTimeout } from './fetch.js';

function renderTrack(html) {
  const track = document.getElementById('sponsor-track');
  if (!track) return;
  track.innerHTML = `<div class="sponsor-track-inner">${html}${html}</div>`;
}

// Testar om en bild-URL faktiskt kan visas — utan fetch, bara img-element
function probeImage(url) {
  return new Promise(resolve => {
    if (!url) return resolve(false);
    const img = new Image();
    img.referrerPolicy = 'no-referrer';
    img.crossOrigin = '';          // ta bort crossorigin-attributet
    const t = setTimeout(() => resolve(false), 5000);
    img.onload  = () => { clearTimeout(t); resolve(true);  };
    img.onerror = () => { clearTimeout(t); resolve(false); };
    img.src = url + (url.includes('?') ? '&' : '?') + '_t=' + Date.now(); // cache-bust
  });
}

export async function loadSponsors() {
  const sponsors = CFG.sponsorer || [];

  // ── 1. Google Drive via Apps Script ──────────────────────────
  if (CFG.driveSponsorFolderId && CFG.appsScriptUrl) {
    try {
      const r = await fetchWithTimeout(
        CFG.appsScriptUrl + '?action=sponsorbilder&folderId=' + encodeURIComponent(CFG.driveSponsorFolderId)
      );
      const d = await r.json();
      if (Array.isArray(d) && d.length) {
        const html = d.map((s, i) => {
          const sNamn  = escapeHtml(s.namn || 'Sponsor ' + (i + 1));
          const href   = escapeHtml(s.webb || '#');
          // Apps Script returnerar antingen base64 eller en publik URL
          const imgSrc = s.base64
            ? `data:${s.mimeType || 'image/png'};base64,${s.base64}`
            : escapeHtml(s.url || '');
          if (!imgSrc) return `<span class="sponsor-placeholder">${sNamn}</span>`;
          return `<a href="${href}" target="_blank" rel="noopener" title="${sNamn}">
            <img class="sponsor-logo" src="${imgSrc}" alt="${sNamn}" loading="lazy" decoding="async">
          </a>`;
        }).join('');
        renderTrack(html);
        return;
      }
    } catch (e) {
      console.warn('loadSponsors: Drive-anrop misslyckades →', e.message);
    }
  }

  // ── 2. Fallback: CFG.sponsorer ───────────────────────────────
  if (!sponsors.length) {
    // Inga sponsorer konfigurerade alls — dölj bannern
    const bar = document.getElementById('sponsor-bar');
    if (bar) bar.classList.add('hidden');
    return;
  }

  // Visa namn direkt som platshållare medan vi testar bilderna
  const placeholders = sponsors.map(s => {
    const sNamn = escapeHtml(s.namn || 'Sponsor');
    const href  = escapeHtml(s.webbUrl || '#');
    return `<a href="${href}" target="_blank" rel="noopener" title="${sNamn}">
      <span class="sponsor-placeholder">${sNamn}</span>
    </a>`;
  }).join('');
  renderTrack(placeholders);

  // Testa alla bilder parallellt med img-element (undviker CORS-problem)
  const ok = await Promise.all(sponsors.map(s => probeImage(s.logoUrl || '')));

  const html = sponsors.map((s, i) => {
    const sNamn = escapeHtml(s.namn || 'Sponsor');
    const href  = escapeHtml(s.webbUrl || '#');
    if (ok[i] && s.logoUrl) {
      return `<a href="${href}" target="_blank" rel="noopener" title="${sNamn}">
        <img class="sponsor-logo" src="${s.logoUrl}" alt="${sNamn}"
             referrerpolicy="no-referrer" loading="lazy" decoding="async">
      </a>`;
    }
    // Bilden laddade inte — behåll namntext istället
    return `<a href="${href}" target="_blank" rel="noopener" title="${sNamn}">
      <span class="sponsor-placeholder">${sNamn}</span>
    </a>`;
  }).join('');

  renderTrack(html);
}