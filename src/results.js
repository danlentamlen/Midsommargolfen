// ── Resultat-rendering ──────────────────────────────────────
import { CFG } from './config.js';
import { fetchWithTimeout } from './fetch.js';

const PAR3_HAL  = [2, 4, 6, 14, 16];
const LD_HAL    = [7, 17];
const MEDALS    = ['🥇', '🥈', '🥉', '4', '5'];

export async function laddaResultat() {
  if (!CFG.appsScriptUrl) { renderSample(); return; }
  try {
    const r = await fetchWithTimeout(CFG.appsScriptUrl + '?action=hamtaResultat', {}, 8000);
    const d = await r.json();
    renderResultat(d.individuellt || [], d.lag || [], d.tavling || {});
  } catch {
    renderFel();
  }
}

function renderResultat(individuellt, lag, tavling) {
  const el = document.getElementById('resultat-content');
  if (!el) return;

  const harData = individuellt.length > 0 || lag.length > 0;
  if (!harData) {
    el.innerHTML = `<p class="res-empty">Inga scorer inregistrerade ännu. Kom tillbaka efter rundan! ⛳</p>`;
    return;
  }

  el.innerHTML =
    renderIndividuellt(individuellt) +
    renderLag(lag) +
    renderNTP(tavling.ntp || {}) +
    renderLD(tavling.ld || {});
}

// ── Individuellt Top 5 (netto slag) med expanderbar fullista ─
function renderIndividuellt(spelare) {
  if (!spelare.length) return '';

  const renderRow = (sp, i) => `
    <div class="res-lag ${i < 3 ? 'res-podium' : ''}">
      <div class="res-rank">${MEDALS[i] || i + 1}</div>
      <div class="res-info">
        <div class="res-lagnamn">${sp.namn}</div>
        <div class="res-spelare-list">${sp.lagnamn} &nbsp;·&nbsp; ${sp.slagBrutto} slag brutto</div>
      </div>
      <div class="res-tot">${sp.slagNetto}<span class="res-p-label">netto</span></div>
    </div>`;

  const top5  = spelare.slice(0, 5).map(renderRow).join('');
  const resten = spelare.slice(5);

  const expandBtn = resten.length ? `
    <button class="res-expand-btn" onclick="
      const extra = this.previousElementSibling;
      const open = extra.style.display !== 'none';
      extra.style.display = open ? 'none' : 'block';
      this.textContent = open ? '▼ Visa alla ${spelare.length} deltagare' : '▲ Dölj';
    ">▼ Visa alla ${spelare.length} deltagare</button>` : '';

  const extraRows = resten.length ? `
    <div style="display:none">
      ${resten.map((sp, i) => renderRow(sp, i + 5)).join('')}
    </div>` : '';

  return `
    <div class="res-section">
      <div class="res-section-title">⛳ Individuellt — Top 5</div>
      <div class="res-section-sub">Ranking på netto slag (slag brutto − erhållna slag)</div>
      ${top5}
      ${extraRows}
      ${expandBtn}
    </div>`;
}

// ── Lagtävling (middle-2 stableford) ─────────────────────────
function renderLag(lag) {
  if (!lag.length) return '';
  const rows = lag.map((l, i) => {
    const spNamn = (l.spelare || []).map(sp => `<span class="res-spelare">${sp.namn} <em>${sp.totalPoang}p</em></span>`).join('');
    return `
      <div class="res-lag ${i < 3 ? 'res-podium' : ''}">
        <div class="res-rank">${MEDALS[i] || i + 1}</div>
        <div class="res-info">
          <div class="res-lagnamn">${l.lagnamn}</div>
          <div class="res-spelare-list">${spNamn}</div>
        </div>
        <div class="res-tot">${l.totalPoang}<span class="res-p-label">p</span></div>
      </div>`;
  }).join('');

  return `
    <div class="res-section">
      <div class="res-section-title">🏆 Lagtävling</div>
      <div class="res-section-sub">De två mellersta spelarnas Stablefordpoäng per hål summeras</div>
      ${rows}
    </div>`;
}

// ── Närmast hål (par 3) ──────────────────────────────────────
function renderNTP(ntp) {
  const rader = PAR3_HAL.map(h => {
    const v = ntp[h];
    const vinnare = v && v.vinnare ? v.vinnare : '–';
    const avstand = v && v.avstand ? ` <span class="res-tavl-extra">${v.avstand}</span>` : '';
    return `
      <div class="res-tavl-row">
        <div class="res-tavl-hal">Hål ${h}</div>
        <div class="res-tavl-vinnare">${vinnare}${avstand}</div>
      </div>`;
  }).join('');

  return `
    <div class="res-section">
      <div class="res-section-title">🎯 Närmast hål</div>
      <div class="res-section-sub">Par 3-hålen — närmast pinflaggan med första bollen</div>
      <div class="res-tavl-grid">${rader}</div>
    </div>`;
}

// ── Längst drive ─────────────────────────────────────────────
function renderLD(ld) {
  const rader = LD_HAL.map(h => {
    const v = ld[h];
    const vinnare = v && v.vinnare ? v.vinnare : '–';
    const langd = v && v.langd ? ` <span class="res-tavl-extra">${v.langd}</span>` : '';
    return `
      <div class="res-tavl-row">
        <div class="res-tavl-hal">Hål ${h}</div>
        <div class="res-tavl-vinnare">${vinnare}${langd}</div>
      </div>`;
  }).join('');

  return `
    <div class="res-section">
      <div class="res-section-title">💨 Längst drive</div>
      <div class="res-section-sub">Hål 7 och 17 — längsta draget som stannar på fairway</div>
      <div class="res-tavl-grid">${rader}</div>
    </div>`;
}

function renderFel() {
  const el = document.getElementById('resultat-content');
  if (el) el.innerHTML = `<p class="res-empty">Kunde inte hämta resultat. Försök igen om en stund.</p>`;
}

function renderSample() {
  renderResultat(
    [
      { namn: 'Anna Svensson',  lagnamn: 'Lag Örnen',    slagBrutto: 82, erhallna: 18, slagNetto: 64, totalPoang: 38 },
      { namn: 'Carl Lindgren',  lagnamn: 'Lag Albatross', slagBrutto: 79, erhallna: 14, slagNetto: 65, totalPoang: 36 },
      { namn: 'Björn Ekström',  lagnamn: 'Lag Örnen',    slagBrutto: 91, erhallna: 24, slagNetto: 67, totalPoang: 35 },
      { namn: 'Diana Holm',     lagnamn: 'Lag Bogey',     slagBrutto: 88, erhallna: 20, slagNetto: 68, totalPoang: 33 },
      { namn: 'Erik Strand',    lagnamn: 'Lag Albatross', slagBrutto: 95, erhallna: 26, slagNetto: 69, totalPoang: 30 },
    ],
    [
      { lagnamn: 'Lag Örnen',    totalPoang: 68, spelare: [{ namn: 'Anna', totalPoang: 38 }, { namn: 'Björn', totalPoang: 35 }] },
      { lagnamn: 'Lag Albatross',totalPoang: 61, spelare: [{ namn: 'Carl', totalPoang: 36 }, { namn: 'Erik',  totalPoang: 30 }] },
    ],
    {
      ntp: { 2: { vinnare: 'Anna Svensson', avstand: '1,2 m' }, 4: null, 6: null, 14: null, 16: null },
      ld:  { 7: { vinnare: 'Carl Lindgren', langd: '287 m' }, 17: null }
    }
  );
}
