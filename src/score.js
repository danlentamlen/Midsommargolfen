// ============================================================
//  Midsommardagsgolfen 2026 — Score-inmatning v3
//  - Player tabs for free navigation
//  - Editable name + erhållna inline
//  - Auto-save to Sheets (debounced 2s per hole / name / hcp)
// ============================================================

const APPS_SCRIPT_URL = import.meta.env.VITE_APPS_SCRIPT_URL || '';
const LS_KEY      = 'midsommar_score_v3';
const SESSION_KEY = 'midsommar_session_v1';
const SESSION_TTL = 15 * 60 * 1000; // 15 minuter

// ── Bandata ──────────────────────────────────────────────────
export const BANDATA = [
  { hal:  1, par: 5, index: 11 }, { hal:  2, par: 3, index: 15 },
  { hal:  3, par: 4, index:  3 }, { hal:  4, par: 3, index: 17 },
  { hal:  5, par: 4, index:  1 }, { hal:  6, par: 3, index: 13 },
  { hal:  7, par: 4, index:  5 }, { hal:  8, par: 5, index:  9 },
  { hal:  9, par: 4, index:  7 }, { hal: 10, par: 4, index: 10 },
  { hal: 11, par: 5, index:  6 }, { hal: 12, par: 4, index: 16 },
  { hal: 13, par: 4, index:  4 }, { hal: 14, par: 3, index: 14 },
  { hal: 15, par: 5, index: 12 }, { hal: 16, par: 3, index: 18 },
  { hal: 17, par: 4, index:  2 }, { hal: 18, par: 4, index:  8 },
];

// ── Stableford ───────────────────────────────────────────────
export function extraSlag(erhallna, halIndex) {
  const hela = Math.floor(erhallna / 18);
  const rest = erhallna % 18;
  return hela + (halIndex <= rest ? 1 : 0);
}

export function stablefordPoang(slag, par, erhallna, halIndex) {
  if (!slag || slag <= 0) return 0;
  return Math.max(0, par + extraSlag(erhallna, halIndex) - slag + 2);
}

// ── State ────────────────────────────────────────────────────
const state = {
  pw:           '',
  lagnamn:      '',
  spelare:      [],
  aktuellaIdx:  0,
  // spelare[i] = { namn, erhallna, slag:[18], poang:[18] }
};

// ── DOM helpers ──────────────────────────────────────────────
function show(id)         { const e = document.getElementById(id); if (e) e.style.display = 'block'; }
function hide(id)         { const e = document.getElementById(id); if (e) e.style.display = 'none'; }
function setText(id, txt) { const e = document.getElementById(id); if (e) e.textContent = txt; }
function setErr(id, txt)  { const e = document.getElementById(id); if (e) { e.textContent = txt; e.style.display = txt ? 'block' : 'none'; } }

const SCREENS = ['screen-login','screen-bekrafta','screen-score','screen-signera','screen-klar'];
function hideAll() { SCREENS.forEach(hide); }

// ── Draft ─────────────────────────────────────────────────────
function sparaDraft() {
  try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch {}
}
function raderaDraft() {
  try { localStorage.removeItem(LS_KEY); } catch {}
}
function hamtaDraft() {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || 'null'); } catch { return null; }
}

// ── Session ───────────────────────────────────────────────────
function sparaSession(pw) {
  try { localStorage.setItem(SESSION_KEY, JSON.stringify({ pw, ts: Date.now() })); } catch {}
}
function fornyaSession() {
  try {
    const s = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
    if (s) sparaSession(s.pw);
  } catch {}
}
function hamtaSession() {
  try {
    const s = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
    if (!s) return null;
    if (Date.now() - s.ts > SESSION_TTL) { localStorage.removeItem(SESSION_KEY); return null; }
    return s.pw;
  } catch { return null; }
}
function raderaSession() {
  try { localStorage.removeItem(SESSION_KEY); } catch {}
}

// ── Utloggning ────────────────────────────────────────────────
function logga_ut() {
  raderaSession();
  raderaDraft();
  Object.assign(state, { pw: '', lagnamn: '', spelare: [], aktuellaIdx: 0 });
  visaUtloggningsknapp(false);
  initLogin();
}

function visaUtloggningsknapp(visa) {
  const btn = document.getElementById('logout-btn');
  if (btn) btn.style.display = visa ? 'flex' : 'none';
}

// ── Poäng-cell rendering ─────────────────────────────────────
function poangHTML(p) {
  if (p <= 0) return `<span class="p-zero">–</span>`;
  if (p >= 4) return `<span class="p-eagle">★ ${p}</span>`;
  if (p === 3) return `<span class="p-birdie">${p}</span>`;
  if (p === 2) return `<span class="p-par">${p}</span>`;
  if (p === 1) return `<span class="p-bogey">${p}</span>`;
  return `<span class="p-double">${p}</span>`;
}

// ── Summary update ───────────────────────────────────────────
function uppdateraSummary(sp) {
  const totalSlag  = sp.slag.reduce((s, v) => s + (v || 0), 0);
  const totalPoang = sp.poang.reduce((s, v) => s + (v || 0), 0);
  const netto      = totalSlag > 0 ? totalSlag - sp.erhallna : null;
  setText('sum-slag',  totalSlag  > 0 ? totalSlag : '–');
  setText('sum-poang', totalPoang);
  setText('sum-netto', netto !== null ? netto : '–');
}

// ── Player total ─────────────────────────────────────────────
function totalPoangForSpelare(sp) {
  return sp.poang.reduce((s, v) => s + (v || 0), 0);
}

// ── Auto-save to Sheets ───────────────────────────────────────
let saveTimer = null;

function setSaveStatus(type, text) {
  const el = document.getElementById('save-status');
  if (!el) return;
  el.className = 'save-status ' + type;
  el.textContent = text;
}

async function sparaTillSheets() {
  if (!APPS_SCRIPT_URL) {
    console.warn('[score] APPS_SCRIPT_URL saknas – sparar ej till Sheets');
    return;
  }
  clearTimeout(saveTimer);
  setSaveStatus('saving', 'Sparar…');

  const payload = {
    action:  'sparaScore',
    pw:      state.pw,
    spelare: state.spelare.map(sp => ({
      namn:       sp.namn,
      erhallna:   sp.erhallna,
      slag:       sp.slag.map(s => s || 0),
      poang:      sp.poang.map(p => p || 0),
      totalPoang: totalPoangForSpelare(sp),
    })),
  };

  console.log('[score] sparaTillSheets →', APPS_SCRIPT_URL, payload);

  try {
    const url = new URL(APPS_SCRIPT_URL);
    url.searchParams.set('action',  'sparaScore');
    url.searchParams.set('payload', JSON.stringify(payload));
    console.log('[score] GET-url längd:', url.toString().length);
    const resp   = await fetch(url.toString());
    const result = await resp.json();
    console.log('[score] svar från Apps Script:', result);
    if (result.ok) {
      setSaveStatus('saved', 'Sparat ✓');
      fornyaSession();
    } else {
      setSaveStatus('error', 'Fel: ' + (result.fel || 'okänt'));
      console.error('[score] Apps Script fel:', result.fel);
    }
  } catch (err) {
    console.error('[score] fetch misslyckades:', err);
    setSaveStatus('error', 'Kunde inte nå servern.');
  }
}

function triggerAutoSave() {
  if (!APPS_SCRIPT_URL) return;
  clearTimeout(saveTimer);
  setSaveStatus('saving', 'Sparar…');
  saveTimer = setTimeout(sparaTillSheets, 2000);
}

// ════════════════════════════════════════════════════════════
//  SCREEN 1 – LOGIN
// ════════════════════════════════════════════════════════════
function initLogin() {
  hideAll();
  show('screen-login');
  setErr('login-err', '');

  // Check if there's a matching draft to restore
  const draft = hamtaDraft();

  const form = document.getElementById('login-form');
  // Remove any stale listener by replacing the form
  const newForm = form.cloneNode(true);
  form.parentNode.replaceChild(newForm, form);

  newForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const pw  = document.getElementById('login-pw').value.trim();
    const btn = document.getElementById('login-btn');
    if (!pw) return;

    btn.disabled = true;
    btn.textContent = 'Loggar in…';
    setErr('login-err', '');

    try {
      const r = await fetch(`${APPS_SCRIPT_URL}?action=lagLogin&pw=${encodeURIComponent(pw)}`);
      const d = await r.json();

      if (!d.ok) {
        setErr('login-err', d.fel || 'Fel lagkod – försök igen.');
        return;
      }

      // Already signed → show locked screen
      if (d.signerad) {
        state.pw      = pw;
        state.lagnamn = d.lagnamn;
        state.spelare = [];
        visaLaastScreen();
        return;
      }

      state.pw      = pw;
      state.lagnamn = d.lagnamn;
      sparaSession(pw);
      visaUtloggningsknapp(true);

      // Bygg spelare från Sheets-svar (inkl. sparade scores)
      const sheetsSpelare = (d.spelare || []).map(sp => ({
        namn:     sp.namn,
        erhallna: sp.erhallna,
        slag:     (sp.slag  && sp.slag.some(v => v > 0))  ? sp.slag  : Array(18).fill(null),
        poang:    (sp.poang && sp.poang.some(v => v > 0)) ? sp.poang : Array(18).fill(0),
      }));
      const harSheetsScore = sheetsSpelare.some(sp => sp.slag.some(v => v > 0));

      if (harSheetsScore) {
        // Sheets har scores → använd dem (ignorera draft)
        state.spelare     = sheetsSpelare;
        state.aktuellaIdx = 0;
        sparaDraft();
        visaScoreScreen(0);
      } else if (draft && draft.pw === pw && draft.spelare?.length > 0) {
        // Inget i Sheets men draft finns → återställ från draft
        state.spelare     = draft.spelare;
        state.aktuellaIdx = draft.aktuellaIdx ?? 0;
        visaScoreScreen(state.aktuellaIdx);
      } else {
        // Helt nystart
        state.spelare = sheetsSpelare;
        sparaDraft();
        visaBekraftaScreen();
      }

    } catch {
      setErr('login-err', 'Nätverksfel – försök igen.');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Logga in';
    }
  });
}

// ════════════════════════════════════════════════════════════
//  SCREEN 2 – BEKRÄFTA SPELARE
// ════════════════════════════════════════════════════════════
function visaBekraftaScreen() {
  hideAll();
  show('screen-bekrafta');
  setText('bek-lagnamn', state.lagnamn);

  const container = document.getElementById('bekrafta-rows');
  container.innerHTML = '';

  for (let i = 0; i < 4; i++) {
    const sp  = state.spelare[i] || { namn: '', erhallna: '' };
    const req = i === 0 ? 'required' : '';
    container.insertAdjacentHTML('beforeend', `
      <div class="sp-row">
        <div class="sp-num">Spelare ${i + 1}${i === 0 ? ' *' : ''}</div>
        <div class="sp-fields">
          <input class="sp-namn" type="text"
                 placeholder="Namn" value="${sp.namn}"
                 ${req} autocomplete="off"
                 style="padding:12px 14px;border:1.5px solid #d0ddd4;border-radius:8px;font-size:16px;" />
          <input class="sp-hcp" type="number"
                 placeholder="Erhållna" value="${sp.erhallna || ''}"
                 min="0" max="72" inputmode="numeric"
                 style="padding:12px 14px;border:1.5px solid #d0ddd4;border-radius:8px;font-size:16px;" />
        </div>
      </div>
    `);
  }

  const bekForm = document.getElementById('bekrafta-form');
  const newForm = bekForm.cloneNode(false);
  bekForm.parentNode.replaceChild(newForm, bekForm);
  // Move children across
  while (bekForm.firstChild) newForm.appendChild(bekForm.firstChild);

  newForm.onsubmit = (e) => {
    e.preventDefault();
    const namnInp = container.querySelectorAll('.sp-namn');
    const hcpInp  = container.querySelectorAll('.sp-hcp');
    const spelare = [];

    for (let i = 0; i < 4; i++) {
      const namn = namnInp[i].value.trim();
      const hcp  = parseInt(hcpInp[i].value) || 0;
      if (i === 0 && !namn) { setErr('bekrafta-err', 'Ange minst en spelare.'); return; }
      if (namn) {
        spelare.push({
          namn,
          erhallna: hcp,
          slag:     Array(18).fill(null),
          poang:    Array(18).fill(0),
        });
      }
    }

    setErr('bekrafta-err', '');
    state.spelare     = spelare;
    state.aktuellaIdx = 0;
    sparaDraft();
    visaScoreScreen(0);
  };
}

// ════════════════════════════════════════════════════════════
//  SCREEN 3 – SCOREINMATNING  (med tabs)
// ════════════════════════════════════════════════════════════
function visaScoreScreen(idx) {
  hideAll();
  show('screen-score');
  state.aktuellaIdx = idx;
  sparaDraft();

  renderTabs(idx);
  renderEditor(idx);
  renderTable(idx);

  // Scroll to top after render
  requestAnimationFrame(() => requestAnimationFrame(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }));

  // Signera-knapp
  const btn = document.getElementById('btn-till-signera');
  btn.onclick = () => { if (!btn.disabled) visaSigneraScreen(); };
}

// ── Tabs ──────────────────────────────────────────────────────
function renderTabs(aktivIdx) {
  const container = document.getElementById('player-tabs');
  container.innerHTML = '';

  state.spelare.forEach((sp, i) => {
    const pts = totalPoangForSpelare(sp);
    const btn = document.createElement('button');
    btn.className = 'p-tab' + (i === aktivIdx ? ' active' : '');
    btn.innerHTML = `
      ${sp.namn || `Spelare ${i + 1}`}
      <span class="p-tab-pts">${pts} p</span>
    `;
    btn.onclick = async () => {
      if (i !== state.aktuellaIdx) {
        document.getElementById('save-overlay')?.classList.add('visible');

        await sparaTillSheets();

        state.aktuellaIdx = i;
        sparaDraft();
        renderTabs(i);
        renderEditor(i);
        renderTable(i);

        document.getElementById('save-overlay')?.classList.remove('visible');
        window.scrollTo({ top: 0, behavior: 'instant' });
      }
    };
    container.appendChild(btn);
  });
}

// ── Editor (name + erhållna) ──────────────────────────────────
function renderEditor(idx) {
  const sp = state.spelare[idx];

  const namnEl = document.getElementById('edit-namn');
  const hcpEl  = document.getElementById('edit-hcp');

  // Swap values without re-attaching (clone would lose refs)
  namnEl.value = sp.namn;
  hcpEl.value  = sp.erhallna;

  // Remove old listeners by replacing
  const namnNew = namnEl.cloneNode(true);
  const hcpNew  = hcpEl.cloneNode(true);
  namnEl.parentNode.replaceChild(namnNew, namnEl);
  hcpEl.parentNode.replaceChild(hcpNew, hcpEl);

  namnNew.addEventListener('blur', () => {
    const v = namnNew.value.trim();
    if (!v || v === sp.namn) return;
    state.spelare[state.aktuellaIdx].namn = v;
    sparaDraft();
    renderTabs(state.aktuellaIdx);
    triggerAutoSave();
  });

  hcpNew.addEventListener('blur', () => {
    const v = parseInt(hcpNew.value) || 0;
    if (v === sp.erhallna) return;
    const s = state.spelare[state.aktuellaIdx];
    s.erhallna = v;
    // Recalculate all hole points
    BANDATA.forEach((hal, i) => {
      s.poang[i] = stablefordPoang(s.slag[i], hal.par, s.erhallna, hal.index);
    });
    sparaDraft();
    // Re-render the whole table so points update
    renderTable(state.aktuellaIdx);
    renderTabs(state.aktuellaIdx);
    triggerAutoSave();
  });

  setSaveStatus('', '');
}

// ── Validering — kontrollera att alla spelare har 18 hål ─────────
function spelareSaknarHal(sp) {
  return sp.slag.filter(s => s === null).length;
}

function uppdateraSigneraKnapp() {
  const btn = document.getElementById('btn-till-signera');
  const err = document.getElementById('score-err');
  if (!btn) return;

  const saknar = state.spelare
    .map((sp, i) => ({ namn: sp.namn || `Spelare ${i + 1}`, hal: spelareSaknarHal(sp) }))
    .filter(x => x.hal > 0);

  if (saknar.length === 0) {
    btn.disabled = false;
    btn.style.opacity = '';
    if (err) { err.textContent = ''; err.style.display = 'none'; }
  } else {
    btn.disabled = true;
    btn.style.opacity = '0.45';
    if (err) {
      err.style.display = 'block';
      err.style.background = '#fff8e1';
      err.style.color = '#7a5c00';
      err.style.borderLeft = '3px solid #c9a84c';
      err.innerHTML = '⚠️ Resultat saknas:<br>' +
        saknar.map(x => `&nbsp;&nbsp;• ${x.namn}: ${x.hal} hål kvar`).join('<br>');
    }
  }
}

// ── Score table ────────────────────────────────────────────────
function renderTable(idx) {
  const sp    = state.spelare[idx];
  const tbody = document.getElementById('score-tbody');
  tbody.innerHTML = '';

  BANDATA.forEach((hal, i) => {
    const slag  = sp.slag[i];   // null = ej inmatat
    const poang = sp.poang[i] || 0;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="hal-nr">${hal.hal}</td>
      <td class="hal-par">Par ${hal.par}</td>
      <td class="hal-hcp">Hcp ${hal.index}</td>
      <td class="hal-input">
        <input type="number" class="slag-input"
               min="0" max="20"
               inputmode="numeric" pattern="[0-9]*"
               data-i="${i}"
               value="${slag !== null ? slag : ''}" placeholder="–" />
      </td>
      <td class="hal-poang" id="poang-${i}">${poangHTML(poang)}</td>
    `;
    tbody.appendChild(tr);
  });

  // Live scoring per hole
  tbody.querySelectorAll('.slag-input').forEach(input => {
    const handleInput = () => {
      const i   = parseInt(input.dataset.i);
      // null = tomt, 0 = explicit noll (fullföljer ej), >0 = slag
      const s   = input.value === '' ? null : (parseInt(input.value) ?? null);
      const hal = BANDATA[i];
      const cur = state.spelare[state.aktuellaIdx];
      const p   = s !== null ? stablefordPoang(s, hal.par, cur.erhallna, hal.index) : 0;
      cur.slag[i]  = s;
      cur.poang[i] = p;
      const cell = document.getElementById(`poang-${i}`);
      if (cell) cell.innerHTML = poangHTML(p);
      uppdateraSummary(cur);
      uppdateraSigneraKnapp();
      sparaDraft();
      // Update tab badge
      const tabs = document.querySelectorAll('.p-tab');
      if (tabs[state.aktuellaIdx]) {
        const badge = tabs[state.aktuellaIdx].querySelector('.p-tab-pts');
        if (badge) badge.textContent = `${totalPoangForSpelare(cur)} p`;
      }
      triggerAutoSave();
    };
    input.addEventListener('input', handleInput);
    input.addEventListener('change', handleInput);
  });

  uppdateraSummary(sp);
  uppdateraSigneraKnapp();
}

// ════════════════════════════════════════════════════════════
//  SCREEN 4 – SIGNERA
// ════════════════════════════════════════════════════════════
function visaSigneraScreen() {
  hideAll();
  show('screen-signera');
  setText('sign-lagnamn', `Lag: ${state.lagnamn}`);

  const playersEl = document.getElementById('sign-players');
  let lagTot = 0;

  playersEl.innerHTML = state.spelare.map(sp => {
    const totalSlag  = sp.slag.reduce((s, v) => s + (v || 0), 0);
    const totalPoang = totalPoangForSpelare(sp);
    const netto      = totalSlag > 0 ? totalSlag - sp.erhallna : '–';
    lagTot += totalPoang;
    return `
      <div class="sign-player">
        <div>
          <div class="sign-name">${sp.namn}</div>
          <div class="sign-meta">
            ${totalSlag} slag &nbsp;·&nbsp; ${sp.erhallna} erhållna &nbsp;·&nbsp; netto ${netto}
          </div>
        </div>
        <div>
          <div class="sign-pts">${totalPoang}</div>
          <div class="sign-pts-lbl">poäng</div>
        </div>
      </div>
    `;
  }).join('');

  setText('sign-lagtot', lagTot);
  setErr('sign-err', '');

  document.getElementById('btn-signera').onclick  = signeraOchSpara;
  document.getElementById('btn-redigera').onclick = () => visaScoreScreen(state.aktuellaIdx);
}

async function signeraOchSpara() {
  const btn = document.getElementById('btn-signera');
  btn.disabled = true;
  btn.textContent = 'Signerar…';
  setErr('sign-err', '');

  // Cancel any pending auto-save first
  clearTimeout(saveTimer);

  const payload = {
    action:  'signeraScore',
    pw:      state.pw,
    spelare: state.spelare.map(sp => ({
      namn:       sp.namn,
      erhallna:   sp.erhallna,
      slag:       sp.slag.map(s => s || 0),
      poang:      sp.poang.map(p => p || 0),
      totalPoang: totalPoangForSpelare(sp),
    })),
  };

  try {
    await fetch(APPS_SCRIPT_URL, {
      method:  'POST',
      mode:    'no-cors',
      headers: { 'Content-Type': 'text/plain' },
      body:    JSON.stringify(payload),
    });
    raderaDraft();
    visaKlarScreen();
  } catch {
    setErr('sign-err', 'Nätverksfel – försök igen om en stund.');
    btn.disabled = false;
    btn.textContent = '✓ Spara & Signera';
  }
}

// ════════════════════════════════════════════════════════════
//  SCREEN 5 – KLAR / LÅST
// ════════════════════════════════════════════════════════════
function visaKlarScreen() {
  hideAll();
  show('screen-klar');
  setText('klar-icon',  '🏆');
  setText('klar-title', 'Scorecard signerad!');
  setText('klar-sub',   `${state.lagnamn} – scorer inlämnade och låsta.`);
  document.getElementById('klar-total-row').style.display = '';

  let lagTot = 0;
  const el = document.getElementById('klar-players');
  el.innerHTML = state.spelare.map(sp => {
    const tot  = totalPoangForSpelare(sp);
    const slag = sp.slag.reduce((s, v) => s + (v || 0), 0);
    lagTot += tot;
    return `
      <div class="klar-player">
        <span>${sp.namn}</span>
        <strong>${tot} p <span style="font-size:12px;color:var(--muted);font-weight:400">(${slag} slag)</span></strong>
      </div>
    `;
  }).join('');
  setText('klar-lagtot', lagTot);
}

function visaLaastScreen() {
  hideAll();
  show('screen-klar');
  setText('klar-icon',  '🔒');
  setText('klar-title', 'Scorecard låst');
  setText('klar-sub',   `${state.lagnamn} – scorerna är signerade och kan inte ändras.`);
  document.getElementById('klar-players').innerHTML = '';
  document.getElementById('klar-total-row').style.display = 'none';
}

// ── Init ─────────────────────────────────────────────────────
async function init() {
  const sessionPw = hamtaSession();
  if (sessionPw) {
    // Auto-återställ utan att visa login-skärmen
    visaUtloggningsknapp(true);
    try {
      const r = await fetch(`${APPS_SCRIPT_URL}?action=lagLogin&pw=${encodeURIComponent(sessionPw)}`);
      const d = await r.json();
      if (d.ok) {
        state.pw      = sessionPw;
        state.lagnamn = d.lagnamn;
        sparaSession(sessionPw); // förnya TTL

        if (d.signerad) { visaLaastScreen(); return; }

        const draft = hamtaDraft();
        const sheetsSpelare = (d.spelare || []).map(sp => ({
          namn:     sp.namn,
          erhallna: sp.erhallna,
          slag:     (sp.slag  && sp.slag.some(v => v > 0))  ? sp.slag  : Array(18).fill(null),
          poang:    (sp.poang && sp.poang.some(v => v > 0)) ? sp.poang : Array(18).fill(0),
        }));
        const harSheetsScore = sheetsSpelare.some(sp => sp.slag.some(v => v !== null));

        if (harSheetsScore) {
          state.spelare = sheetsSpelare; state.aktuellaIdx = 0;
          sparaDraft(); visaScoreScreen(0);
        } else if (draft && draft.pw === sessionPw && draft.spelare?.length > 0) {
          state.spelare = draft.spelare; state.aktuellaIdx = draft.aktuellaIdx ?? 0;
          visaScoreScreen(state.aktuellaIdx);
        } else {
          state.spelare = sheetsSpelare; sparaDraft(); visaBekraftaScreen();
        }
        return;
      }
    } catch {}
    // Session finns men login misslyckades → rensa och visa login
    raderaSession();
  }
  visaUtloggningsknapp(false);
  initLogin();
}

document.addEventListener('DOMContentLoaded', init);
