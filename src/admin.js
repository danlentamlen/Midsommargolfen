import { CFG, RUNTIME_FLAGS } from './config.js';
import { state } from './state.js';
import { escapeHtml } from './utils.js';
import { fetchWithTimeout, postToAppsScript } from './fetch.js';
import { photoKey, getLocalPhotos } from './photos.js';

async function sha256(message) {
  const data = new TextEncoder().encode(message);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2,'0')).join('');
}

export async function adminLogin(showFn, loadDataFn) {
  const pw = document.getElementById('admin-pw').value;
  const hash = await sha256(pw);
  if (hash === CFG.adminLosenordHash) {
    state.adminAuthed = true;
    state.adminPw = pw;   // behåll i minnet — skickas till servern för att verifiera skrivningar
    document.getElementById('admin-login-err').classList.remove('show');
    showFn('admin');
    loadDataFn();
  } else {
    document.getElementById('admin-login-err').classList.add('show');
  }
}

export function adminLogout(showFn) { state.adminAuthed=false; state.adminPw=''; showFn('home'); }

// -- INSTÄLLNINGAR: realtidsflaggor (betting, anmälan, ...) ----
// Speglar varje flagga i RUNTIME_FLAGS på sin switch i admin-panelen.
export function renderAdminSettings() {
  RUNTIME_FLAGS.forEach(({ key, toggleId, labelId }) => {
    const toggle = document.getElementById(toggleId);
    if (!toggle) return;
    const on = CFG[key] !== false;
    toggle.checked = on;
    toggle.setAttribute('aria-checked', String(on));
    const label = document.getElementById(labelId);
    if (label) label.textContent = on ? 'På' : 'Av';
  });
}

// Sparar en flagga i backend (Apps Script). Optimistisk: uppdaterar CFG
// direkt; servern är källan vid nästa sidladdning via ?action=config.
// Lösenordet skickas med så servern kan verifiera skrivningen.
export async function saveConfigFlag(key, value) {
  CFG[key] = value;
  if (CFG.appsScriptUrl) {
    await postToAppsScript(CFG.appsScriptUrl, {
      action: 'setConfig',
      key: key,
      value: value,
      pw: state.adminPw,
    });
  }
  return value;
}

export async function adminLoadData() {
  if (!CFG.appsScriptUrl) {
    renderAdminSample(); return;
  }
  try {
    const r = await fetchWithTimeout(CFG.appsScriptUrl+'?action=adminData');
    const d = await r.json();
    if (d) { state.adminData = d; }
  } catch { /* network error — show cached data */ }
  renderAdminAnm();
  renderAdminBet();
  renderAdminSettings();
}

export function renderAdminSample() {
  state.adminData = {
    anm:[
      {id:0,namn:'Anna Svensson',email:'anna@test.se',telefon:'070-111 22 33',paket:'Golf + Middag & Fest',belopp:'900 kr',status:'Obetald'},
      {id:1,namn:'Per Johansson',email:'per@test.se',telefon:'070-333 44 55',paket:'Enbart Golf',belopp:'500 kr',status:'Obetald'},
      {id:2,namn:'Lisa Reserv',email:'lisa@test.se',telefon:'070-666 77 88',paket:'Reservlista Golf',belopp:'0 kr',status:'GolfReserv'},
    ],
    bet:[
      {id:0,namn:'Maria Ek',email:'maria@test.se',telefon:'070-999 00 11',spelare:'Spelare A, Spelare B',belopp:'40 kr',status:'Obetald'},
    ]
  };
  renderAdminAnm(); renderAdminBet(); renderAdminSettings();
}

export function renderAdminAnm() {
  const alla = state.adminData.anm || [];
  document.getElementById('adm-anm-cnt').textContent =
    alla.filter(r => r.status==='Obetald' || r.status==='GolfReserv').length;

  if (!alla.length) {
    document.getElementById('admin-anm-body').innerHTML =
      `<tr><td colspan="7" class="admin-empty">Inga anmälningar ännu</td></tr>`;
    return;
  }

  document.getElementById('admin-anm-body').innerHTML = alla.map(r => {
    const rowBg = r.status==='Betald'     ? 'background:#f0faf0'
                : r.status==='Återbetald' ? 'background:#fffde7'
                : r.status==='GolfReserv' ? 'background:#e3f2fd'
                : r.status==='Antagen'    ? 'background:#fff3e0'
                : '';

    const sNamn    = escapeHtml(r.namn    || '');
    const sEmail   = escapeHtml(r.email   || '');
    const sTelefon = escapeHtml(r.telefon || '—');
    const sPaket   = escapeHtml(r.paket   || '');
    const sBelopp  = escapeHtml(r.belopp  || '');

    let mailBtns;
    if (r.status === 'Obetald') {
      mailBtns = `
        <button class="admin-mail-btn admin-mail-btn--reminder"
                data-mail-type="anm" data-mail-id="${r.id}"
                data-mail-email="${sEmail}" data-mail-namn="${sNamn}" data-mail-status="Påminnelse"
                title="Skicka betalningspåminnelse">
          🔔 Påminnelse
        </button>`;
    } else if (r.status === 'Betald') {
      mailBtns = `
        <button class="admin-mail-btn"
                data-mail-type="anm" data-mail-id="${r.id}"
                data-mail-email="${sEmail}" data-mail-namn="${sNamn}" data-mail-status="Betald">
          ✉ Kvitto
        </button>`;
    } else if (r.status === 'Återbetald') {
      mailBtns = `
        <button class="admin-mail-btn"
                data-mail-type="anm" data-mail-id="${r.id}"
                data-mail-email="${sEmail}" data-mail-namn="${sNamn}" data-mail-status="Återbetald">
          ✉ Återbet.
        </button>`;
    } else if (r.status === 'GolfReserv') {
      mailBtns = `
        <button class="admin-mail-btn"
                data-mail-type="anm" data-mail-id="${r.id}"
                data-mail-email="${sEmail}" data-mail-namn="${sNamn}" data-mail-status="GolfReserv">
          ✉ Reserv-mail
        </button>
        <button class="admin-mail-btn admin-mail-btn--promote"
                data-promote-id="${r.id}"
                data-promote-email="${sEmail}" data-promote-namn="${sNamn}"
                title="Anta till golf och skicka betalningsmail automatiskt">
          ⛳ Anta till Golf
        </button>`;
    } else if (r.status === 'Antagen') {
      mailBtns = `
        <button class="admin-mail-btn"
                data-mail-type="anm" data-mail-id="${r.id}"
                data-mail-email="${sEmail}" data-mail-namn="${sNamn}" data-mail-status="Antagen">
          ✉ Skicka igen
        </button>`;
    } else {
      mailBtns = `<span style="font-size:11px;color:var(--muted)">—</span>`;
    }

    const badgeCls = r.status==='Betald'     ? 's-be'
                   : r.status==='Återbetald' ? 's-at'
                   : r.status==='GolfReserv' ? 's-re'
                   : r.status==='Antagen'    ? 's-an'
                   : 's-ob';
    const badgeTxt = r.status==='GolfReserv' ? 'Reserv'
                   : r.status==='Antagen'    ? 'Antagen'
                   : r.status;

    return `<tr style="${rowBg}">
      <td><strong>${sNamn}</strong></td>
      <td style="font-size:12px">${sTelefon}</td>
      <td style="font-size:12px">${sEmail}</td>
      <td>${sPaket}</td>
      <td>${sBelopp}</td>
      <td>
        <select class="admin-sel" data-status-type="anm" data-status-id="${r.id}">
          <option ${r.status==='Obetald'    ?'selected':''}>Obetald</option>
          <option ${r.status==='Betald'     ?'selected':''}>Betald</option>
          <option ${r.status==='Återbetald' ?'selected':''}>Återbetald</option>
          <option ${r.status==='GolfReserv' ?'selected':''}>GolfReserv</option>
          <option ${r.status==='Antagen'    ?'selected':''}>Antagen</option>
        </select>
        ${r.status==='Antagen' || r.status==='Obetald' ? `
          <select class="admin-sel" style="margin-top:4px"
                  data-paket-type="anm" data-paket-id="${r.id}">
            <option ${sPaket.includes('Fest')||sPaket.includes('full') ?'selected':''}>Golf + Middag & Fest</option>
            <option ${sPaket.includes('Enbart Golf')                   ?'selected':''}>Enbart Golf</option>
            <option ${sPaket.includes('Fest')&&!sPaket.includes('Golf')?'selected':''}>Enbart Fest</option>
          </select>` : ''}
        <span class="status-badge ${badgeCls}" style="margin-left:6px">${badgeTxt}</span>
      </td>
      <td>${mailBtns}</td>
    </tr>`;
  }).join('');
}

export function renderAdminBet() {
  const alla = state.adminData.bet || [];
  document.getElementById('adm-bet-cnt').textContent = alla.filter(r=>r.status==='Obetald').length;

  if (!alla.length) {
    document.getElementById('admin-bet-body').innerHTML =
      `<tr><td colspan="7" class="admin-empty">Inga bets ännu</td></tr>`;
    return;
  }

  document.getElementById('admin-bet-body').innerHTML = alla.map(r => {
    const rowBg    = r.status==='Betald'     ? 'background:#f0faf0'
                   : r.status==='Återbetald' ? 'background:#fffde7'
                   : '';
    const sNamn    = escapeHtml(r.namn    || '');
    const sEmail   = escapeHtml(r.email   || '');
    const sTelefon = escapeHtml(r.telefon || '—');
    const sSpelare = escapeHtml(r.spelare || '');
    const sBelopp  = escapeHtml(r.belopp  || '');

    let mailBtn;
    if (r.status === 'Obetald') {
      mailBtn = `
        <button class="admin-mail-btn admin-mail-btn--reminder"
                data-mail-type="bet" data-mail-id="${r.id}"
                data-mail-email="${sEmail}" data-mail-namn="${sNamn}" data-mail-status="Påminnelse"
                title="Skicka betalningspåminnelse">
          🔔 Påminnelse
        </button>`;
    } else if (r.status === 'Betald') {
      mailBtn = `
        <button class="admin-mail-btn"
                data-mail-type="bet" data-mail-id="${r.id}"
                data-mail-email="${sEmail}" data-mail-namn="${sNamn}" data-mail-status="Betald">
          ✉ Kvitto
        </button>`;
    } else if (r.status === 'Återbetald') {
      mailBtn = `
        <button class="admin-mail-btn"
                data-mail-type="bet" data-mail-id="${r.id}"
                data-mail-email="${sEmail}" data-mail-namn="${sNamn}" data-mail-status="Återbetald">
          ✉ Återbet.
        </button>`;
    } else {
      mailBtn = `<span style="font-size:11px;color:var(--muted)">—</span>`;
    }

    return `<tr style="${rowBg}">
      <td><strong>${sNamn}</strong></td>
      <td style="font-size:12px">${sTelefon}</td>
      <td style="font-size:12px">${sEmail}</td>
      <td style="font-size:12px">${sSpelare}</td>
      <td>${sBelopp}</td>
      <td>
        <select class="admin-sel" data-status-type="bet" data-status-id="${r.id}">
          <option ${r.status==='Obetald'    ?'selected':''}>Obetald</option>
          <option ${r.status==='Betald'     ?'selected':''}>Betald</option>
          <option ${r.status==='Återbetald' ?'selected':''}>Återbetald</option>
        </select>
      </td>
      <td>${mailBtn}</td>
    </tr>`;
  }).join('');
}

// -- FOTO ADMIN ------------------------------------------------
export function renderAdminFoto(renderGolfGridFn, renderPlayersFn) {
  const grid   = document.getElementById('admin-foto-grid');
  const photos = getLocalPhotos();
  const keys   = Object.keys(photos);

  if (!keys.length) {
    grid.innerHTML = '<div style="color:var(--muted);font-size:13px;font-style:italic">Inga foton uppladdade ännu.</div>';
    return;
  }

  const playerMap = {};
  [...(state.allParts||[]), ...(state.betPlayers||[])].forEach(p => {
    const k = photoKey(p);
    if (!playerMap[k]) playerMap[k] = p.name;
  });

  grid.innerHTML = keys.map(key => {
    const url  = photos[key];
    const namn = escapeHtml(playerMap[key] || key);
    return `<div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r);overflow:hidden;text-align:center">
      <div style="width:100%;aspect-ratio:1;overflow:hidden;background:var(--mint)">
        <img src="${url}" alt="${namn}" loading="lazy" style="width:100%;height:100%;object-fit:cover">
      </div>
      <div style="padding:.6rem .5rem">
        <div style="font-size:12px;font-weight:600;color:var(--ink);margin-bottom:.4rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${namn}">${namn}</div>
        <button class="admin-delete-photo-btn" data-photo-key="${key}"
          style="width:100%;padding:5px 8px;border:1px solid var(--danger);border-radius:7px;background:transparent;color:var(--danger);font-size:11px;font-weight:500;cursor:pointer;font-family:var(--sans)">
          🗑 Ta bort foto
        </button>
      </div>
    </div>`;
  }).join('');
}

export async function deletePhoto(key, renderGolfGridFn, renderPlayersFn) {
  if (!confirm('Ta bort foto? Spelaren kan sedan ladda upp ett nytt.')) return;

  const photos = getLocalPhotos();
  delete photos[key];
  try { localStorage.setItem('golf_photos', JSON.stringify(photos)); } catch { /* full */ }

  if (CFG.appsScriptUrl && CFG.drivePhotoFolderId) {
    const url = CFG.appsScriptUrl
      + '?action=raderaFoto'
      + '&namn='     + encodeURIComponent(key)
      + '&folderId=' + encodeURIComponent(CFG.drivePhotoFolderId);
    try {
      const r = await fetchWithTimeout(url);
      const d = await r.json();
      if (!d.ok) console.error('Apps Script kunde inte radera foto:', d.fel);
    } catch(e) {
      console.error('Nätverksfel vid radering:', e);
    }
  }

  if (renderGolfGridFn) renderGolfGridFn();
  if (renderPlayersFn) renderPlayersFn();
}

export function adminTab(tab, btn, renderAdminFotoFn) {
  document.querySelectorAll('.admin-tab').forEach(b=>b.classList.remove('on'));
  btn.classList.add('on');
  document.getElementById('admin-anm-view').style.display     = tab==='anm'     ? 'block' : 'none';
  document.getElementById('admin-bet-view').style.display     = tab==='bet'     ? 'block' : 'none';
  document.getElementById('admin-foto-view').style.display    = tab==='foto'    ? 'block' : 'none';
  document.getElementById('admin-lag-view').style.display     = tab==='lag'     ? 'block' : 'none';
  document.getElementById('admin-tavling-view').style.display = tab==='tavling' ? 'block' : 'none';
  document.getElementById('admin-guide-view').style.display   = tab==='guide'   ? 'block' : 'none';
  if (tab==='foto'    && renderAdminFotoFn) renderAdminFotoFn();
  if (tab==='tavling') laddaTavlingAdmin();
  if (tab==='lag')     laddaAdminLag();
}

// -- TÄVLING ADMIN -----------------------------------------------
const NTP_HAL = [2, 4, 6, 14, 16];
const LD_HAL  = [7, 17];

function tavlingInputRow(hal, vinnare, extra, extraLabel) {
  return `
    <div style="display:grid;grid-template-columns:60px 1fr 1fr;gap:8px;align-items:center;margin-bottom:8px">
      <div style="font-weight:600;font-size:14px;color:var(--ink)">Hål ${hal}</div>
      <input type="text" placeholder="Vinnare" value="${escapeHtml(vinnare||'')}"
             data-tavl-vinnare="${hal}"
             style="padding:8px 10px;border:1.5px solid var(--border);border-radius:8px;font-family:var(--sans);font-size:13px">
      <input type="text" placeholder="${escapeHtml(extraLabel)}" value="${escapeHtml(extra||'')}"
             data-tavl-extra="${hal}"
             style="padding:8px 10px;border:1.5px solid var(--border);border-radius:8px;font-family:var(--sans);font-size:13px">
    </div>`;
}

export async function laddaTavlingAdmin() {
  // Fetch existing data from Apps Script to pre-fill fields
  let tavling = { ntp: {}, ld: {} };
  if (CFG.appsScriptUrl) {
    try {
      const r = await fetchWithTimeout(CFG.appsScriptUrl + '?action=hamtaTavling', {}, 6000);
      const d = await r.json();
      tavling = d || tavling;
    } catch { /* use empty */ }
  }

  const ntpRows = document.getElementById('ntp-rows');
  const ldRows  = document.getElementById('ld-rows');
  if (!ntpRows || !ldRows) return;

  ntpRows.innerHTML = NTP_HAL.map(h => {
    const v = tavling.ntp?.[h] || {};
    return tavlingInputRow(h, v.vinnare, v.avstand, 'Avstånd (t.ex. 1,2 m)');
  }).join('');

  ldRows.innerHTML = LD_HAL.map(h => {
    const v = tavling.ld?.[h] || {};
    return tavlingInputRow(h, v.vinnare, v.langd, 'Längd (t.ex. 287 m)');
  }).join('');
}

export async function saveTavlingData() {
  if (!CFG.appsScriptUrl) { alert('Konfigurera Apps Script URL först.'); return; }
  const btn = document.getElementById('save-tavling-btn');
  const msg = document.getElementById('tavling-save-msg');
  btn.disabled = true; btn.textContent = 'Sparar…';
  msg.textContent = '';

  const reqs = [];

  NTP_HAL.forEach(h => {
    const vinnare = document.querySelector(`[data-tavl-vinnare="${h}"]`)?.value?.trim() ?? '';
    const avstand = document.querySelector(`[data-tavl-extra="${h}"]`)?.value?.trim() ?? '';
    reqs.push(postToAppsScript(CFG.appsScriptUrl, {
      action: 'setTavling', pw: state.adminPw, typ: 'ntp', hal: h, vinnare, avstand
    }));
  });

  LD_HAL.forEach(h => {
    const vinnare = document.querySelector(`[data-tavl-vinnare="${h}"]`)?.value?.trim() ?? '';
    const langd   = document.querySelector(`[data-tavl-extra="${h}"]`)?.value?.trim() ?? '';
    reqs.push(postToAppsScript(CFG.appsScriptUrl, {
      action: 'setTavling', pw: state.adminPw, typ: 'ld', hal: h, vinnare, langd
    }));
  });

  try {
    await Promise.all(reqs);
    msg.style.color = '#2e7d32';
    msg.textContent = '✓ Tävlingsresultat sparat!';
  } catch {
    msg.style.color = '#c62828';
    msg.textContent = '⚠ Fel vid sparning – försök igen';
  }

  btn.disabled = false;
  btn.textContent = 'Spara tävlingsresultat';
  setTimeout(() => { msg.textContent = ''; }, 4000);
}

// -- LAG ADMIN --------------------------------------------------
let _gruppSpelareNamn = {}; // cache: { grupp: [namn] }

export async function laddaAdminLag() {
  const list = document.getElementById('lag-list');
  if (!list) return;
  list.innerHTML = '<div style="color:var(--muted);font-size:13px;padding:.75rem 0">Laddar lag…</div>';
  if (!CFG.appsScriptUrl) { renderAdminLag([]); return; }
  try {
    const [rLag, rSpelare] = await Promise.all([
      fetchWithTimeout(CFG.appsScriptUrl + '?action=hamtaLag', {}, 8000),
      fetchWithTimeout(CFG.appsScriptUrl + '?action=hamtaGruppSpelareNamn', {}, 8000),
    ]);
    const lag     = await rLag.json();
    const spelare = await rSpelare.json();
    _gruppSpelareNamn = (spelare && typeof spelare === 'object') ? spelare : {};
    renderAdminLag(Array.isArray(lag) ? lag : []);
  } catch {
    list.innerHTML = '<div style="color:var(--danger,#c62828);font-size:13px;padding:.5rem 0">⚠ Kunde inte ladda lag.</div>';
  }
}

function renderAdminLag(lagar) {
  const list = document.getElementById('lag-list');
  if (!list) return;
  if (!lagar.length) {
    list.innerHTML = '<div style="color:var(--muted);font-size:13px;font-style:italic;padding:.5rem 0">Inga lag registrerade ännu. Klicka "+ Lägg till lag" för att börja.</div>';
    return;
  }
  list.innerHTML = `
    <table style="width:100%;border-collapse:collapse;font-family:var(--sans);font-size:13px">
      <thead>
        <tr style="border-bottom:2px solid var(--border)">
          <th style="text-align:left;padding:8px 10px;font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.05em">Lagnamn</th>
          <th style="text-align:left;padding:8px 10px;font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.05em">Lagkod</th>
          <th style="text-align:left;padding:8px 10px;font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.05em">Grupp</th>
          <th style="text-align:left;padding:8px 10px;font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.05em">Signerat</th>
          <th style="padding:8px 10px"></th>
        </tr>
      </thead>
      <tbody>
        ${lagar.map(l => `
          <tr style="border-bottom:1px solid var(--border)">
            <td style="padding:9px 10px">
              <div style="font-weight:600;color:var(--ink)">${escapeHtml(l.lagnamn)}</div>
              <div style="font-size:11px;margin-top:2px;color:${l.lagledare ? 'var(--pine)' : '#c62828'}">
                ${l.lagledare ? '👤 ' + escapeHtml(l.lagledare) : '⚠ Ingen lagledare vald'}
              </div>
            </td>
            <td style="padding:9px 10px;font-family:monospace;font-size:12px;color:var(--pine)">${escapeHtml(l.losenord)}</td>
            <td style="padding:9px 10px;color:var(--muted)">${escapeHtml(l.grupp)}</td>
            <td style="padding:9px 10px">
              <button class="lag-sign-btn"
                data-lag-rad="${l.rad}"
                data-lag-signerad="${l.signerad}"
                style="padding:4px 12px;border-radius:20px;font-size:12px;font-weight:600;cursor:pointer;font-family:var(--sans);border:1.5px solid ${l.signerad ? '#2e7d32' : 'var(--border)'};background:${l.signerad ? '#e8f5e9' : 'transparent'};color:${l.signerad ? '#2e7d32' : 'var(--muted)'}">
                ${l.signerad ? '✓ Signerat' : '○ Ej signerat'}
              </button>
            </td>
            <td style="padding:9px 10px;text-align:right;white-space:nowrap">
              <button class="lag-mail-btn"
                data-lag-namn="${escapeHtml(l.lagnamn)}"
                data-lag-kod="${escapeHtml(l.losenord)}"
                data-lag-lagledare="${escapeHtml(l.lagledare || '')}"
                ${!l.lagledare ? 'disabled title="Välj lagledare via Redigera innan du skickar"' : ''}
                style="padding:5px 11px;border:1.5px solid ${l.lagledare ? '#1565c0' : 'var(--border)'};border-radius:7px;background:transparent;color:${l.lagledare ? '#1565c0' : 'var(--muted)'};font-size:12px;font-weight:600;cursor:${l.lagledare ? 'pointer' : 'not-allowed'};font-family:var(--sans);margin-right:4px;opacity:${l.lagledare ? '1' : '0.5'}">
                ✉ Skicka
              </button>
              <button class="lag-edit-btn"
                data-lag-rad="${l.rad}"
                data-lag-namn="${escapeHtml(l.lagnamn)}"
                data-lag-kod="${escapeHtml(l.losenord)}"
                data-lag-grupp="${escapeHtml(l.grupp)}"
                data-lag-lagledare="${escapeHtml(l.lagledare || '')}"
                style="padding:5px 11px;border:1.5px solid var(--pine);border-radius:7px;background:transparent;color:var(--pine);font-size:12px;font-weight:600;cursor:pointer;font-family:var(--sans);margin-right:4px">
                ✏ Redigera
              </button>
              <button class="lag-delete-btn"
                data-lag-rad="${l.rad}"
                data-lag-namn="${escapeHtml(l.lagnamn)}"
                style="padding:5px 11px;border:1.5px solid #c62828;border-radius:7px;background:transparent;color:#c62828;font-size:12px;font-weight:600;cursor:pointer;font-family:var(--sans)">
                🗑 Ta bort
              </button>
            </td>
          </tr>`).join('')}
      </tbody>
    </table>`;
}

export function visaLagForm(rad, lagnamn, losenord, grupp, lagledare) {
  document.getElementById('lag-f-namn').value  = lagnamn  || '';
  document.getElementById('lag-f-kod').value   = losenord || '';
  document.getElementById('lag-f-grupp').value = grupp    || '';
  document.getElementById('lag-f-rad').value   = rad      || '';
  document.getElementById('lag-form-title').textContent = rad ? 'Redigera lag' : 'Lägg till lag';
  document.getElementById('lag-form-msg').textContent   = '';

  // Fyll dropdown med spelare för den valda gruppen
  const sel = document.getElementById('lag-f-lagledare');
  const spelare = (grupp && _gruppSpelareNamn[grupp]) || [];
  sel.innerHTML = '<option value="">– Välj lagledare –</option>' +
    spelare.map(n => `<option value="${escapeHtml(n)}" ${n === lagledare ? 'selected' : ''}>${escapeHtml(n)}</option>`).join('');
  if (!spelare.length && grupp) {
    sel.innerHTML += `<option disabled>Inga spelare i grupp ${escapeHtml(grupp)} ännu</option>`;
  }

  document.getElementById('lag-form').style.display = 'block';
  document.getElementById('lag-f-namn').focus();
}

export function doljLagForm() {
  document.getElementById('lag-form').style.display = 'none';
}

export async function sparaLag() {
  const lagnamn  = document.getElementById('lag-f-namn')?.value?.trim();
  const losenord = document.getElementById('lag-f-kod')?.value?.trim();
  const grupp    = document.getElementById('lag-f-grupp')?.value?.trim();
  const rad      = document.getElementById('lag-f-rad')?.value?.trim();
  const msg      = document.getElementById('lag-form-msg');

  if (!lagnamn || !losenord || !grupp) {
    msg.style.color = '#c62828';
    msg.textContent = 'Fyll i alla fält.';
    return;
  }
  if (!CFG.appsScriptUrl) {
    msg.style.color = '#c62828';
    msg.textContent = 'Ingen Apps Script URL konfigurerad.';
    return;
  }

  const btn = document.getElementById('lag-form-save');
  btn.disabled = true; btn.textContent = 'Sparar…';
  msg.textContent = '';

  const lagledare = document.getElementById('lag-f-lagledare')?.value?.trim() || '';

  try {
    const payload = { action: 'sparaLag', pw: state.adminPw, lagnamn, losenord, grupp, lagledare };
    if (rad) payload.rad = Number(rad);
    await postToAppsScript(CFG.appsScriptUrl, payload);
    // no-cors — can't read response; wait briefly then reload
    await new Promise(r => setTimeout(r, 700));
    document.getElementById('lag-form').style.display = 'none';
    await laddaAdminLag();
  } catch {
    msg.style.color = '#c62828';
    msg.textContent = '⚠ Nätverksfel – försök igen';
  }
  btn.disabled = false; btn.textContent = 'Spara';
}

export async function raderaLag(rad, lagnamn) {
  if (!confirm(`Ta bort laget "${lagnamn}"? Det går inte att ångra.`)) return;
  if (!CFG.appsScriptUrl) return;
  try {
    await postToAppsScript(CFG.appsScriptUrl, { action: 'raderaLag', pw: state.adminPw, rad: Number(rad) });
    await new Promise(r => setTimeout(r, 700));
    await laddaAdminLag();
  } catch {
    alert('Nätverksfel – försök igen');
  }
}

export async function sattSignerad(rad, nyttVarde, btn) {
  if (!CFG.appsScriptUrl) return;
  // Optimistic UI: flip immediately
  const ny = !nyttVarde;
  btn.dataset.lagSignerad = String(ny);
  btn.textContent = ny ? '✓ Signerat' : '○ Ej signerat';
  btn.style.borderColor  = ny ? '#2e7d32' : 'var(--border)';
  btn.style.background   = ny ? '#e8f5e9' : 'transparent';
  btn.style.color        = ny ? '#2e7d32' : 'var(--muted)';
  btn.disabled = true;

  try {
    await postToAppsScript(CFG.appsScriptUrl, { action: 'sattSignerad', pw: state.adminPw, rad: Number(rad), signerad: ny });
    await new Promise(r => setTimeout(r, 600));
  } catch { /* fire-and-forget, state already flipped */ }

  btn.disabled = false;
}

export async function skickaLagMail(lagnamn, losenord) {
  // Visa förhandsvisningsmodal
  const url = 'https://midsommardagsgolfen.netlify.app/score';
  const preview =
    `Hej [Spelares namn]!\n\n` +
    `Du spelar i ${lagnamn} på Midsommardagsgolfen 2026.\n\n` +
    `Så här matar ni in era scores på tävlingsdagen:\n\n` +
    `  Länk:    ${url}\n` +
    `  Lagkod:  ${losenord}\n\n` +
    `En person i laget loggar in med lagkoden och matar in alla fyra spelares slag hål för hål. ` +
    `Glöm inte att klicka Granska och sedan Signera när ni är klara!\n\n` +
    `/Tävlingsledningen`;

  const skicka = await new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9999;display:flex;align-items:center;justify-content:center;padding:1rem';
    overlay.innerHTML = `
      <div style="background:#fff;border-radius:16px;padding:1.75rem;max-width:480px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,.3);font-family:var(--sans)">
        <div style="font-family:Georgia,serif;font-size:1.2rem;font-weight:700;color:var(--pine);margin-bottom:.25rem">✉ Skicka instruktioner</div>
        <div style="font-size:13px;color:var(--muted);margin-bottom:1rem">Till alla spelare i <strong>${escapeHtml(lagnamn)}</strong> (hämtas från Anmälningar-fliken)</div>
        <div style="background:#f5f5f5;border-radius:8px;padding:.85rem 1rem;font-size:12px;color:#444;white-space:pre-wrap;line-height:1.6;max-height:260px;overflow-y:auto;margin-bottom:1.25rem">${escapeHtml(preview)}</div>
        <div style="display:flex;gap:10px">
          <button id="lm-cancel" style="flex:1;padding:11px;border:1.5px solid var(--border);border-radius:10px;background:#fff;font-size:14px;cursor:pointer;font-family:var(--sans)">Avbryt</button>
          <button id="lm-send" style="flex:2;padding:11px;border:none;border-radius:10px;background:linear-gradient(135deg,#1565c0,#1976d2);color:#fff;font-size:14px;font-weight:600;cursor:pointer;font-family:var(--sans)">Skicka till laget →</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.querySelector('#lm-cancel').onclick = () => { document.body.removeChild(overlay); resolve(false); };
    overlay.querySelector('#lm-send').onclick   = () => { document.body.removeChild(overlay); resolve(true); };
  });

  if (!skicka || !CFG.appsScriptUrl) return;

  // Visa spinner-toast under sändning
  const toast = document.createElement('div');
  toast.style.cssText = 'position:fixed;bottom:2rem;left:50%;transform:translateX(-50%);background:#333;color:#fff;padding:.75rem 1.5rem;border-radius:10px;font-family:var(--sans);font-size:14px;font-weight:600;z-index:9999;box-shadow:0 4px 20px rgba(0,0,0,.2)';
  toast.textContent = '⏳ Skickar mail…';
  document.body.appendChild(toast);

  try {
    const url = CFG.appsScriptUrl
      + '?action=skickaLagMail'
      + '&pw='      + encodeURIComponent(state.adminPw)
      + '&lagnamn=' + encodeURIComponent(lagnamn);
    const r = await fetchWithTimeout(url, {}, 15000);
    const d = await r.json();

    if (d.ok) {
      toast.style.background = '#1565c0';
      toast.textContent = `✓ Mail skickat till ${escapeHtml(d.mottagare || lagnamn)}`;
    } else {
      toast.style.background = '#c62828';
      toast.textContent = '⚠ ' + (d.fel || 'Okänt fel');
    }
  } catch (e) {
    toast.style.background = '#c62828';
    toast.textContent = '⚠ Nätverksfel – försök igen';
  }

  setTimeout(() => { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 5000);
}

export async function updateStatus(type, id, status) {
  if (!CFG.appsScriptUrl) return;
  await postToAppsScript(CFG.appsScriptUrl, {action:'updateStatus', type, id, status});
  await adminLoadData();
}

export async function sendConfirmMail(type, id, email, namn, status, btn) {
  if (!CFG.appsScriptUrl) { alert('Konfigurera Apps Script URL först.'); return; }
  const origText = btn.textContent;
  btn.textContent='Skickar...'; btn.disabled=true;
  await postToAppsScript(CFG.appsScriptUrl, {action:'sendMail', type, id, email, namn, status: status||'Obetald'});
  btn.textContent='✓ Skickat!';
  setTimeout(()=>{ btn.textContent=origText; btn.disabled=false; }, 3000);
}

// -- NY FUNKTION: Konvertera reservist → antagen golfare ----------
export async function promoteReservist(id, email, namn, btn) {
  if (!CFG.appsScriptUrl) { alert('Konfigurera Apps Script URL först.'); return; }

  // Paketväljare som dialog
  const val = await new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9999;display:flex;align-items:center;justify-content:center';
    overlay.innerHTML = `
      <div style="background:#fff;border-radius:16px;padding:2rem;max-width:380px;width:90%;box-shadow:0 20px 60px rgba(0,0,0,.3)">
        <div style="font-family:Georgia,serif;font-size:1.3rem;font-weight:700;color:#0c3318;margin-bottom:.5rem">⛳ Anta till Golf</div>
        <div style="font-size:14px;color:#666;margin-bottom:1.5rem">Välj paket för <strong>${namn}</strong></div>
        <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:1.5rem">
          <label style="display:flex;align-items:center;gap:12px;padding:12px 16px;border:2px solid #e0e0e0;border-radius:10px;cursor:pointer">
            <input type="radio" name="prm-pkg" value="full" checked style="accent-color:#0c3318">
            <div><div style="font-weight:600;font-size:14px">⭐ Fullt paket</div><div style="font-size:12px;color:#888">Golf + Middag & Fest — 900 kr</div></div>
          </label>
          <label style="display:flex;align-items:center;gap:12px;padding:12px 16px;border:2px solid #e0e0e0;border-radius:10px;cursor:pointer">
            <input type="radio" name="prm-pkg" value="golf" style="accent-color:#0c3318">
            <div><div style="font-weight:600;font-size:14px">⛳ Enbart Golf</div><div style="font-size:12px;color:#888">Utan kvällsevenemang — 500 kr</div></div>
          </label>
        </div>
        <div style="display:flex;gap:10px">
          <button id="prm-cancel" style="flex:1;padding:11px;border:1.5px solid #ddd;border-radius:10px;background:#fff;font-size:14px;cursor:pointer;font-family:var(--sans)">Avbryt</button>
          <button id="prm-confirm" style="flex:2;padding:11px;border:none;border-radius:10px;background:linear-gradient(135deg,#2e7d32,#43a047);color:#fff;font-size:14px;font-weight:600;cursor:pointer;font-family:var(--sans)">Anta & skicka mail →</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    overlay.querySelector('#prm-cancel').onclick  = () => { document.body.removeChild(overlay); resolve(null); };
    overlay.querySelector('#prm-confirm').onclick = () => {
      const pkg = overlay.querySelector('input[name="prm-pkg"]:checked')?.value || 'full';
      document.body.removeChild(overlay);
      resolve(pkg);
    };
  });

  if (!val) return; // Avbruten

  const belopp = val === 'full' ? CFG.prisFull : CFG.prisGolf;
  const origText = btn.textContent;
  btn.textContent = 'Skickar...';
  btn.disabled = true;

  try {
    // Steg 1: Uppdatera status + paket + belopp
    await postToAppsScript(CFG.appsScriptUrl, {
      action: 'updateStatus', type: 'anm', id, status: 'Antagen', paket: val, belopp
    });

    // Steg 2: Skicka antagningsmail
    await postToAppsScript(CFG.appsScriptUrl, {
      action: 'sendMail', type: 'anm', id, email, namn, status: 'Antagen', paket: val
    });

    btn.textContent = '✓ Antagen & mailad!';
    setTimeout(async () => {
      btn.textContent = origText;
      btn.disabled = false;
      await adminLoadData();
    }, 2500);
  } catch (e) {
    console.error('promoteReservist misslyckades:', e);
    btn.textContent = '⚠ Fel – försök igen';
    setTimeout(() => { btn.textContent = origText; btn.disabled = false; }, 3000);
  }
}

export async function updatePaket(id, paket) {
  if (!CFG.appsScriptUrl) return;
  const belopp = paket.includes('Enbart Golf') ? CFG.prisGolf
               : paket.includes('Fest') && !paket.includes('Golf') ? CFG.prisFest
               : CFG.prisFull;
  await postToAppsScript(CFG.appsScriptUrl, {
    action: 'updatePaket', type: 'anm', id, paket, belopp
  });
  await adminLoadData();
}
