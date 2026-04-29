import './styles.css';
import { CFG, PAGE_IDX, BN_IDS } from './config.js';
import { state, SAMPLE } from './state.js';
import { formatTel, clearE, sanitizeHtml } from './utils.js';
import { omHistoria, infoInnehall, sponsringInnehall } from './content.js';
import { loadSponsors, renderSponsorGrid } from './sponsors.js';
import { buildPkgs, buildStartlista, updateCap, renderGolfGrid, handlePhoto, pkgChange, submitReg, setRenderPlayers } from './registration.js';
import { renderPlayers, toggleP, renderOdds, submitBet } from './betting.js';
import { adminLogin, adminLogout, adminLoadData, adminTab, updateStatus, sendConfirmMail, renderAdminFoto, deletePhoto } from './admin.js';
import { fetchWithTimeout } from './fetch.js';
import { fetchDrivePhotos } from './photos.js';

setRenderPlayers(renderPlayers);

// -- INJECT LOGO -----------------------------------------------
const LOGO_CACHE_KEY = 'midsommar_logo_url';

function setLogoSrc(src) {
  ['nav-logo','hero-logo'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.onload = () => {
      el.style.background = '';
      el.style.transition = 'opacity .3s';
      el.style.opacity = '1';
    };
    el.src = src;
  });
}

async function loadLogo() {
  ['nav-logo','hero-logo'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.style.opacity = '0'; el.style.background = 'var(--pine)'; }
  });

  const cached = localStorage.getItem(LOGO_CACHE_KEY);
  if (cached) {
    setLogoSrc(cached);
    refreshLogoCache();
    return;
  }
  await refreshLogoCache();
}

async function refreshLogoCache() {
  if (!CFG.driveLogoFolderId || !CFG.appsScriptUrl) {
    setLogoSrc('/logo.jpg');
    return;
  }
  try {
    const r = await fetchWithTimeout(
      CFG.appsScriptUrl + '?action=logo&folderId=' + encodeURIComponent(CFG.driveLogoFolderId)
    );
    const d = await r.json();
    if (d.ok && (d.url || d.base64)) {
      const src = d.url || `data:${d.mimeType};base64,${d.base64}`;
      try { localStorage.setItem(LOGO_CACHE_KEY, src); } catch { /* localStorage full */ }
      setLogoSrc(src);
      return;
    }
  } catch(e) {
    console.warn('loadLogo: misslyckades', e);
  }
  setLogoSrc('/public/logo.jpg');
}

loadLogo();

// -- INIT DOM FROM CFG ----------------------------------------
document.getElementById('nav-name').textContent = CFG.eventNamn;
document.getElementById('nav-sub').textContent  = 'Rya GK · 20 Juni 2026';
document.getElementById('h-plats').textContent  = CFG.eventPlats;
document.getElementById('h-datum').textContent  = CFG.eventDatum;
document.getElementById('h-middag').textContent = 'Middag ' + CFG.middagStart;
document.getElementById('hf-slag').textContent      = CFG.slagstart;
document.getElementById('hf-slag-meta').textContent = CFG.slagstart;
document.getElementById('h-title').innerHTML    = CFG.eventNamn.replace('golfen','<em>golfen</em>');
document.getElementById('form-sub').textContent = CFG.eventNamn + ' · Rya GK · 20 Juni';
document.getElementById('as-full').textContent  = CFG.prisFull + ' kr';
document.getElementById('as-golf').textContent  = CFG.prisGolf + ' kr';
document.getElementById('as-fest').textContent  = CFG.prisFest + ' kr';
document.getElementById('as-datum').textContent = CFG.eventDatum;
document.getElementById('as-plats').textContent = CFG.eventPlats;
document.getElementById('as-slag').textContent  = CFG.slagstart;
document.getElementById('as-middag').textContent= CFG.middagStart;
document.getElementById('bet-rule-pris').textContent = `💰 ${CFG.prisBetPerSpel} kr per vald spelare`;

// -- TEASER MODAL ---------------------------------------------
function showTeaser() {
  const modal = document.getElementById('teaser-modal');
  document.getElementById('teaser-msg').textContent = CFG.teaserMeddelande || 'Vi öppnar snart!';
  modal.classList.add('open');
}

document.getElementById('teaser-modal')?.addEventListener('click', (e) => {
  if (e.target === document.getElementById('teaser-modal') || e.target.closest('[data-close-teaser]')) {
    document.getElementById('teaser-modal').classList.remove('open');
  }
});

// -- DATA FETCH ------------------------------------------------
async function fetchData() {
  if (!CFG.appsScriptUrl) {
    state.allParts   = [...SAMPLE];
    state.betPlayers = SAMPLE.filter(p=>p.pkg!=='party');
    updateCap(state.allParts);
    buildPkgs();   // ← bygg om paketen med korrekt kapacitet
    pkgChange();
    renderGolfGrid();
    renderPlayers();
    renderOdds();
    showDemoBanner();
    return;
  }
  hideLoadError();
  try {
    const [rP, rD] = await Promise.all([
      fetchWithTimeout(CFG.appsScriptUrl+'?action=spelare'),
      fetchWithTimeout(CFG.appsScriptUrl+'?action=deltagare')
    ]);
    const dP = await rP.json();
    const dD = await rD.json();
    if (dP && dP.length) state.betPlayers = dP;
    if (dD && dD.length) state.allParts   = dD;
  } catch {
    showLoadError();
  }
  updateCap(state.allParts);
  buildPkgs();   // ← bygg om paketen nu när vi vet faktisk kapacitet
  pkgChange();
  renderGolfGrid();
  renderPlayers();
  renderOdds();
  fetchDrivePhotos([...state.allParts, ...state.betPlayers]).then(() => {
    renderGolfGrid();
    renderPlayers();
  });
}

// -- DEMO BANNER & ERROR FALLBACK -----------------------------
function showDemoBanner() {
  if (document.getElementById('demo-banner')) return;
  const banner = document.createElement('div');
  banner.id = 'demo-banner';
  banner.setAttribute('role', 'status');
  banner.style.cssText = 'background:var(--gold-bg);color:var(--gold-dk);text-align:center;padding:8px 16px;font-size:13px;font-family:var(--sans);border-bottom:1px solid var(--gold-lt)';
  banner.textContent = '⚠️ Demoläge — ingen API konfigurerad. Data visas lokalt.';
  document.body.prepend(banner);
}

function showLoadError() {
  const el = document.getElementById('load-error');
  if (el) { el.style.display = 'block'; return; }
  const box = document.createElement('div');
  box.id = 'load-error';
  box.setAttribute('role', 'alert');
  box.style.cssText = 'background:var(--danger-bg);color:var(--danger);text-align:center;padding:10px 16px;font-size:13px;font-family:var(--sans);display:flex;align-items:center;justify-content:center;gap:8px';
  box.innerHTML = '<span>Kunde inte ladda data.</span><button id="retry-btn" style="padding:4px 12px;border:1px solid var(--danger);border-radius:4px;background:transparent;color:var(--danger);cursor:pointer;font-size:12px">Försök igen</button>';
  const navEl = document.querySelector('.nav');
  if (navEl) navEl.after(box);
  else document.body.prepend(box);
  document.getElementById('retry-btn')?.addEventListener('click', () => fetchData());
}

function hideLoadError() {
  const el = document.getElementById('load-error');
  if (el) el.style.display = 'none';
}

// -- NAVIGATION ------------------------------------------------
function show(id) {
  if (id === 'admin' && !state.adminAuthed) { show('admin-login'); return; }
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('on'));
  document.getElementById('page-'+id).classList.add('on','fade');
  document.querySelectorAll('.nav-link').forEach(b=>b.classList.remove('on'));
  BN_IDS.forEach(b=>document.getElementById(b)?.classList.remove('on'));
  const idx = PAGE_IDX[id];
  if (idx !== null && idx !== undefined) {
    document.querySelectorAll('.nav-link')[idx]?.classList.add('on');
    document.getElementById(BN_IDS[idx])?.classList.add('on');
  }
  if (id==='list')      { renderGolfGrid(); }
  if (id==='bet')       { renderPlayers(); renderOdds(); }
  if (id==='om')        { renderOmPage(); }
  if (id==='info')      { renderInfoPage(); }
  if (id==='sponsring') { renderSponringPage(); }
  if (id==='admin')     { adminLoadData(); }
  window.scrollTo(0,0);
  const skipHash = ['admin','admin-login','confirm','bet-confirm'];
  if (!skipHash.includes(id)) history.replaceState(null,'','#'+id);
}

function navTo(id) {
  if (id === 'reg'  && !CFG.visaAnmalan)   { showTeaser(); return false; }
  if (id === 'list' && !CFG.visaDeltagare) { showTeaser(); return false; }
  if (id === 'bet'  && !CFG.visaBetting)   { showTeaser(); return false; }
  show(id);
  return true;
}

function mmOpen()  { document.getElementById('mm-ov').classList.add('open'); }
function mmClose(e){ if(!e||e.target===document.getElementById('mm-ov')) document.getElementById('mm-ov').classList.remove('open'); }

// -- OM, INFO & SPONSRING PAGES -------------------------------
function renderOmPage() {
  const el = document.getElementById('om-content');
  const fb = document.getElementById('om-fallback');
  if (omHistoria?.trim()) {
    el.innerHTML = sanitizeHtml(omHistoria);
    el.style.display = 'block';
    fb.style.display = 'none';
  } else {
    el.style.display = 'none';
    fb.style.display = 'block';
  }
}

function renderInfoPage() {
  const el = document.getElementById('info-content');
  const fb = document.getElementById('info-fallback');
  if (infoInnehall?.trim()) {
    el.innerHTML = sanitizeHtml(infoInnehall);
    el.style.display = 'block';
    fb.style.display = 'none';
  } else {
    el.style.display = 'none';
    fb.style.display = 'block';
  }
}

function renderSponringPage() {
  const el = document.getElementById('sponsring-content');
  const fb = document.getElementById('sponsring-fallback');
  if (sponsringInnehall?.trim()) {
    el.innerHTML = sanitizeHtml(sponsringInnehall);
    el.style.display = 'block';
    fb.style.display = 'none';
  } else {
    el.style.display = 'none';
    fb.style.display = 'block';
  }
  renderSponsorGrid();
}

// -- VISIBILITY -----------------------------------------------
function setVis(id, visible) {
  const el = document.getElementById(id);
  if (!el) return;
  if (visible) { el.style.removeProperty('display'); } else { el.style.display = 'none'; }
}

function applyVisibility() {
  const visaBet = CFG.visaBetting !== false;
  ['nav-bet-btn','mm-bet-btn','hero-bet-btn','confirm-bet-btn','bn-bet'].forEach(id => setVis(id, visaBet));
  const pageBet = document.getElementById('page-bet');
  if (pageBet && !visaBet) pageBet.style.display = 'none';

  const visaReg = CFG.visaAnmalan !== false;
  ['nav-reg-btn','mm-reg-btn','bn-reg'].forEach(id => setVis(id, visaReg));
  const navCta = document.querySelector('.nav-cta');
  if (navCta) { if (!visaReg) { navCta.style.display = 'none'; } else { navCta.style.removeProperty('display'); } }

  const visaList = CFG.visaDeltagare !== false;
  ['nav-list-btn','mm-list-btn','bn-list'].forEach(id => setVis(id, visaList));
}

// -- EVENT LISTENERS ------------------------------------------

// Förhindra att externa <a>-länkklick bubblar upp till SPA-navigering
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[href]');
  if (a && (a.href.startsWith('http') || a.target === '_blank')) {
    e.stopPropagation();
  }
});

// Navigation — alla data-nav knappar via navTo()
document.querySelectorAll('[data-nav]').forEach(btn => {
  btn.addEventListener('click', () => navTo(btn.dataset.nav));
});

// Mobile menu
document.querySelectorAll('[data-mm-nav]').forEach(btn => {
  btn.addEventListener('click', () => { navTo(btn.dataset.mmNav); mmClose(); });
});
document.getElementById('ham')?.addEventListener('click', mmOpen);
document.getElementById('mm-ov')?.addEventListener('click', (e) => mmClose(e));

// Nav brand — triple-tap for admin
let logoTapCount = 0, logoTapTimer;
document.getElementById('nav-brand').addEventListener('click', () => {
  logoTapCount++;
  clearTimeout(logoTapTimer);
  logoTapTimer = setTimeout(() => {
    if (logoTapCount === 1 || logoTapCount === 2) show('home');
    logoTapCount = 0;
  }, 400);
  if (logoTapCount >= 3) {
    clearTimeout(logoTapTimer);
    logoTapCount = 0;
    show('admin');
  }
});

// Package cards på startsidan
document.getElementById('pkg-grid')?.addEventListener('click', (e) => {
  if (e.target.closest('[data-action="show-reg"]')) navTo('reg');
});

// Package radio
document.getElementById('p-opts')?.addEventListener('change', (e) => {
  if (e.target.name === 'pkg') pkgChange();
});

// Registration
document.getElementById('reg-btn')?.addEventListener('click', () => submitReg(show));

// Input clearing
document.querySelectorAll('[data-clear]').forEach(el => {
  el.addEventListener('input', () => clearE(el.dataset.clear));
});

// Phone formatting
document.querySelectorAll('[data-format-tel]').forEach(el => {
  el.addEventListener('input', () => { el.value = formatTel(el.value); });
});

// Betting — data-player-idx
document.getElementById('players-grid')?.addEventListener('click', (e) => {
  const card = e.target.closest('[data-player-idx]');
  if (card) toggleP(Number(card.dataset.playerIdx));
});

// Betting — ta bort spelare via ✕-knappen
document.querySelector('.bet-panel-body')?.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-remove-idx]');
  if (btn) toggleP(Number(btn.dataset.removeIdx));
});

document.getElementById('bet-sub-btn')?.addEventListener('click', () => submitBet(show));

// Admin login
document.querySelector('.admin-login-body')?.addEventListener('click', (e) => {
  if (e.target.closest('.full-btn')) adminLogin(show, adminLoadData);
});
document.getElementById('admin-pw')?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') adminLogin(show, adminLoadData);
});

// Admin logout & refresh
document.querySelector('.admin-layout')?.addEventListener('click', (e) => {
  const action = e.target.closest('[data-action]')?.dataset.action;
  if (action === 'admin-logout') adminLogout(show);
  if (action === 'admin-refresh') adminLoadData();
});

// Admin tabs
document.querySelector('.admin-tabs')?.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-admin-tab]');
  if (btn) adminTab(btn.dataset.adminTab, btn, () => renderAdminFoto(renderGolfGrid, renderPlayers));
});

// Golf grid photo uploads
document.getElementById('golf-grid')?.addEventListener('change', (e) => {
  const input = e.target.closest('[data-photo-key]');
  if (input && input.files?.[0]) handlePhoto(input.dataset.photoKey, input.files[0], renderGolfGrid, renderPlayers);
});

// Admin foto
document.querySelector('.admin-layout')?.addEventListener('change', (e) => {
  const inp = e.target.closest('[data-foto-pid]');
  if (inp && inp.files?.[0]) {
    handlePhoto(inp.dataset.fotoPid, inp.files[0], renderGolfGrid, renderPlayers);
    renderAdminFoto(renderGolfGrid, renderPlayers);
  }
});

// Admin status dropdowns
document.querySelector('.admin-table-wrap')?.addEventListener('change', (e) => {
  const sel = e.target.closest('[data-status-type]');
  if (sel) updateStatus(sel.dataset.statusType, parseInt(sel.dataset.statusId, 10), sel.value);
});

// Admin mail buttons
document.querySelector('.admin-table-wrap')?.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-mail-type]');
  if (btn) sendConfirmMail(btn.dataset.mailType, parseInt(btn.dataset.mailId, 10), btn.dataset.mailEmail, btn.dataset.mailNamn, btn.dataset.mailStatus, btn);
});

// Admin foto-borttagning
document.querySelector('.admin-layout')?.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-photo-key]');
  if (btn) {
    deletePhoto(btn.dataset.photoKey, renderGolfGrid, renderPlayers);
    renderAdminFoto(renderGolfGrid, renderPlayers);
  }
});

// -- INIT ------------------------------------------------------
buildPkgs();
pkgChange();
updateCap(state.allParts);
renderGolfGrid();
renderPlayers();
renderOdds();
buildStartlista();
renderOmPage();
renderInfoPage();
renderSponringPage();
applyVisibility();
fetchData(); // ← anropar buildPkgs() + pkgChange() igen efter data laddats

const loadSp = () => loadSponsors();
if ('requestIdleCallback' in window) {
  requestIdleCallback(loadSp);
} else {
  setTimeout(loadSp, 200);
}

// Restore page from URL hash
const validPages = Object.keys(PAGE_IDX).filter(k => PAGE_IDX[k] !== null && k !== 'confirm' && k !== 'bet-confirm');
const hashPage   = window.location.hash.replace('#','');
if (hashPage && validPages.includes(hashPage)) {
  navTo(hashPage);
}