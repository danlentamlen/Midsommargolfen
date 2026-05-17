import { CFG } from './config.js';
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
    document.getElementById('admin-login-err').classList.remove('show');
    showFn('admin');
    loadDataFn();
  } else {
    document.getElementById('admin-login-err').classList.add('show');
  }
}

export function adminLogout(showFn) { state.adminAuthed=false; showFn('home'); }

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
  renderAdminAnm(); renderAdminBet();
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
  document.getElementById('admin-anm-view').style.display  = tab==='anm'  ? 'block' : 'none';
  document.getElementById('admin-bet-view').style.display  = tab==='bet'  ? 'block' : 'none';
  document.getElementById('admin-foto-view').style.display = tab==='foto' ? 'block' : 'none';
  if (tab==='foto' && renderAdminFotoFn) renderAdminFotoFn();
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
