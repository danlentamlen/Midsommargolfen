import { CFG } from './config.js';
import { state } from './state.js';
import { escapeHtml } from './utils.js';
import { fetchWithTimeout } from './fetch.js';
import { photoKey, getLocalPhotos, saveLocalPhoto } from './photos.js';

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
      {id:1,namn:'Anna Svensson',email:'anna@test.se',paket:'Golf + Middag & Fest',belopp:'900 kr',status:'Obetald'},
      {id:2,namn:'Per Johansson',email:'per@test.se',paket:'Enbart Golf',belopp:'500 kr',status:'Obetald'},
    ],
    bet:[
      {id:1,namn:'Maria Ek',email:'maria@test.se',spelare:'Spelare A, Spelare B',belopp:'40 kr',status:'Obetald'},
    ]
  };
  renderAdminAnm(); renderAdminBet();
}

export function renderAdminAnm() {
  const alla = state.adminData.anm || [];
  document.getElementById('adm-anm-cnt').textContent = alla.filter(r=>r.status==='Obetald').length;
  if (!alla.length) {
    document.getElementById('admin-anm-body').innerHTML = `<tr><td colspan="7" class="admin-empty">Inga anmälningar ännu</td></tr>`;
    return;
  }
  document.getElementById('admin-anm-body').innerHTML = alla.map(r => {
    const rowBg    = r.status==='Betald' ? 'background:#f0faf0' : r.status==='Återbetald' ? 'background:#fffde7' : '';
    const sNamn    = escapeHtml(r.namn    || '');
    const sEmail   = escapeHtml(r.email   || '');
    const sTelefon = escapeHtml(r.telefon || '—');
    const sPaket   = escapeHtml(r.paket   || '');
    const sBelopp  = escapeHtml(r.belopp  || '');
    const mailBtn  = r.status !== 'Obetald'
      ? `<button class="admin-mail-btn" data-mail-type="anm" data-mail-id="${r.id}" data-mail-email="${sEmail}" data-mail-namn="${sNamn}" data-mail-status="${r.status}">
           ✉ ${r.status==='Betald' ? 'Kvitto' : 'Återbet.'}
         </button>`
      : `<span style="font-size:11px;color:var(--muted)">—</span>`;
    return `<tr style="${rowBg}">
      <td><strong>${sNamn}</strong></td>
      <td style="font-size:12px">${sTelefon}</td>
      <td style="font-size:12px">${sEmail}</td>
      <td>${sPaket}</td>
      <td>${sBelopp}</td>
      <td>
        <select class="admin-sel" data-status-type="anm" data-status-id="${r.id}">
          <option ${r.status==='Obetald'?'selected':''}>Obetald</option>
          <option ${r.status==='Betald'?'selected':''}>Betald</option>
          <option ${r.status==='Återbetald'?'selected':''}>Återbetald</option>
        </select>
      </td>
      <td>${mailBtn}</td>
    </tr>`;
  }).join('');
}

export function renderAdminBet() {
  const alla = state.adminData.bet || [];
  document.getElementById('adm-bet-cnt').textContent = alla.filter(r=>r.status==='Obetald').length;
  if (!alla.length) {
    document.getElementById('admin-bet-body').innerHTML = `<tr><td colspan="7" class="admin-empty">Inga bets ännu</td></tr>`;
    return;
  }
  document.getElementById('admin-bet-body').innerHTML = alla.map(r => {
    const rowBg    = r.status==='Betald' ? 'background:#f0faf0' : r.status==='Återbetald' ? 'background:#fffde7' : '';
    const sNamn    = escapeHtml(r.namn    || '');
    const sEmail   = escapeHtml(r.email   || '');
    const sTelefon = escapeHtml(r.telefon || '—');
    const sSpelare = escapeHtml(r.spelare || '');
    const sBelopp  = escapeHtml(r.belopp  || '');
    const mailBtn  = r.status !== 'Obetald'
      ? `<button class="admin-mail-btn" data-mail-type="bet" data-mail-id="${r.id}" data-mail-email="${sEmail}" data-mail-namn="${sNamn}" data-mail-status="${r.status}">
           ✉ ${r.status==='Betald' ? 'Kvitto' : 'Återbet.'}
         </button>`
      : `<span style="font-size:11px;color:var(--muted)">—</span>`;
    return `<tr style="${rowBg}">
      <td><strong>${sNamn}</strong></td>
      <td style="font-size:12px">${sTelefon}</td>
      <td style="font-size:12px">${sEmail}</td>
      <td style="font-size:12px">${sSpelare}</td>
      <td>${sBelopp}</td>
      <td>
        <select class="admin-sel" data-status-type="bet" data-status-id="${r.id}">
          <option ${r.status==='Obetald'?'selected':''}>Obetald</option>
          <option ${r.status==='Betald'?'selected':''}>Betald</option>
          <option ${r.status==='Återbetald'?'selected':''}>Återbetald</option>
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

  // Map photo keys to player names for readable labels
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

export function deletePhoto(key, renderGolfGridFn, renderPlayersFn) {
  if (!confirm('Ta bort foto? Spelaren kan sedan ladda upp ett nytt.')) return;
  const photos = getLocalPhotos();
  delete photos[key];
  try { localStorage.setItem('golf_photos', JSON.stringify(photos)); } catch { /* full */ }
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
  try {
    await fetchWithTimeout(CFG.appsScriptUrl, {method:'POST', body:JSON.stringify({action:'updateStatus',type,id,status})});
    await adminLoadData();
  } catch { alert('Kunde inte uppdatera status.'); }
}

export async function sendConfirmMail(type, id, email, namn, status, btn) {
  if (!CFG.appsScriptUrl) { alert('Konfigurera Apps Script URL först.'); return; }
  const origText = btn.textContent;
  btn.textContent='Skickar...'; btn.disabled=true;
  try {
    await fetchWithTimeout(CFG.appsScriptUrl, {method:'POST', body:JSON.stringify({action:'sendMail',type,id,email,namn,status:status||'Obetald'})});
    btn.textContent='✓ Skickat!';
    setTimeout(()=>{btn.textContent=origText;btn.disabled=false;},3000);
  } catch { btn.textContent=origText; btn.disabled=false; alert('Kunde inte skicka mail.'); }
}
