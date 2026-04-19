import { CFG } from './config.js';
import { escapeHtml } from './utils.js';
import { fetchWithTimeout } from './fetch.js';

// Bygger en img-tagg med referrerpolicy för att kringgå blockering
function logoImg(src, alt) {
  return `<img class="sponsor-logo" src="${src}" alt="${alt}" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.closest('a')?.remove()">`;
}

// Sätter innerHTML på sponsor-track med duplicerat innehåll för sömlös loop
function renderTrack(items) {
  const track = document.getElementById('sponsor-track');
  // Duplicera listan så animationen loopar sömlöst
  const html = items.join('');
  track.innerHTML = `<div class="sponsor-track-inner">${html}${html}</div>`;
}

export async function loadSponsors() {
  const track = document.getElementById('sponsor-track');
  const sponsors = CFG.sponsorer || [];

  // -- Försök hämta sponsorer från Google Drive -----------------
  if (CFG.driveSponsorFolderId && CFG.appsScriptUrl) {
    try {
      const r = await fetchWithTimeout(CFG.appsScriptUrl + '?action=sponsorbilder&folderId=' + encodeURIComponent(CFG.driveSponsorFolderId));
      const d = await r.json();
      if (d && d.length) {
        const items = d.map((s, i) => {
          const sNamn = escapeHtml(s.namn || 'Sponsor ' + (i + 1));
          const imgSrc = s.base64 ? `data:${s.mimeType||'image/png'};base64,${s.base64}` : s.url;
          return `<a href="${escapeHtml(s.webb||'#')}" target="_blank" rel="noopener" title="${sNamn}">${logoImg(imgSrc, sNamn)}</a>`;
        });
        renderTrack(items);
        return;
      }
    } catch { /* Drive fetch misslyckades, fortsätt */ }
  }

  // -- Fallback: CFG.sponsorer med fetch → blob ----------------
  if (sponsors.length) {
    // Visa namn som platshållare direkt, ladda bilder asynkront
    const items = sponsors.map((s, i) => {
      const sNamn = escapeHtml(s.namn || 'Sponsor');
      return `<a href="${escapeHtml(s.webbUrl||'#')}" target="_blank" rel="noopener" title="${sNamn}" id="sp-link-${i}">
        <span class="sponsor-placeholder" id="sp-ph-${i}">${sNamn}</span>
      </a>`;
    });
    renderTrack(items);

    // Ladda varje bild via fetch → blob (kringgår referrer-blockering)
    // Uppdaterar BÅDA kopiorna (original + duplikat för loop)
    sponsors.forEach(async (s, i) => {
      if (!s.logoUrl) return;
      try {
        const r = await fetch(s.logoUrl);
        if (!r.ok) return;
        const blob = await r.blob();
        const blobUrl = URL.createObjectURL(blob);
        // Ersätt alla platshållare med samma index (original + kopia)
        document.querySelectorAll(`#sp-ph-${i}`).forEach(ph => {
          const img = document.createElement('img');
          img.className = 'sponsor-logo';
          img.src = blobUrl;
          img.alt = escapeHtml(s.namn || 'Sponsor');
          img.loading = 'lazy';
          img.decoding = 'async';
          ph.replaceWith(img);
        });
      } catch { /* lämna kvar platshållartexten */ }
    });
    return;
  }

  // -- Sista fallback: generiska platshållare ------------------
  const items = Array.from({length: 4}, (_, i) =>
    `<div class="sponsor-placeholder">Sponsor ${i + 1}</div>`
  );
  renderTrack(items);
}