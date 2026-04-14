import { CFG } from './config.js';
import { state } from './state.js';
import { formatTel, showErr, escapeHtml } from './utils.js';
import { photoKey, getLocalPhotos } from './photos.js';
import { fetchWithTimeout } from './fetch.js';

export function renderPlayers() {
  const photos = getLocalPhotos();
  document.getElementById('players-grid').innerHTML = state.betPlayers.map((p,i) => {
    const init = p.name.split(' ').map(w=>w[0]).join('').slice(0,2);
    const isSel = state.selectedPlayers.has(i);
    const isDis = !isSel && state.selectedPlayers.size >= 5;
    const ph = photos[photoKey(p)]||'';
    return `<div class="p-card ${isSel?'sel':''} ${isDis?'dis':''}" data-player-idx="${i}">
      <div class="p-av">${ph?`<img src="${ph}" decoding="async">`:'<span>'+escapeHtml(init)+'</span>'}</div>
      <div><div class="p-name">${escapeHtml(p.name)}</div><div class="p-hcp">HCP ${escapeHtml(String(p.hcp||'—'))}</div></div>
      <div class="p-chk">${isSel?'✓':''}</div>
    </div>`;
  }).join('') || '<div style="grid-column:1/-1;text-align:center;padding:2rem;color:var(--muted)">Inga golfspelare anmälda ännu</div>';
  updateBetPanel();
}

export function toggleP(idx) {
  if (state.selectedPlayers.has(idx)) state.selectedPlayers.delete(idx);
  else { if (state.selectedPlayers.size>=5){alert('Max 5 spelare.');return;} state.selectedPlayers.add(idx); }
  renderPlayers();
}

export function updateBetPanel() {
  const cnt = state.selectedPlayers.size, tot = cnt * CFG.prisBetPerSpel;
  document.getElementById('bet-cnt-lbl').textContent = cnt+' / 5';
  document.getElementById('bet-prog').style.width = (cnt/5*100)+'%';
  document.getElementById('bet-pris-lbl').textContent = tot+' kr';
  document.getElementById('bet-tot-val').textContent = tot ? tot+' kr' : '0 kr';
  document.getElementById('bet-tot-sub').textContent = cnt ? `${cnt} × ${CFG.prisBetPerSpel} kr = ${tot} kr` : 'Välj minst 1 spelare';
  document.getElementById('bet-sub-btn').disabled = cnt===0;
  const listEl = document.getElementById('bet-sel-list');
  if (!cnt) { listEl.innerHTML='<div class="bet-empty"><div class="bet-empty-ic">🎯</div>Ingen spelare vald</div>'; return; }
  listEl.innerHTML = Array.from(state.selectedPlayers).map(idx => {
    const n = state.betPlayers[idx]?.name || '';
    return `<div class="bet-sel-row"><span class="bet-sel-nm">${escapeHtml(n)}</span><button class="bet-sel-rm" data-remove-idx="${idx}">✕</button></div>`;
  }).join('');
}

export function renderOdds() {
  const entries = state.betPlayers
    .map((p, i) => ({idx: i, id: p.spelarid || ('idx_'+i), bets: p.bets||0}))
    .filter(e => e.bets > 0);

  const totalBets = entries.reduce((s, e) => s + e.bets, 0);

  if (totalBets === 0) {
    document.getElementById('odds-list').innerHTML = '<div class="odds-empty">Inga bet har lagts ännu — var den första! 🎯</div>';
    return;
  }

  const sorted = [...entries].sort((a,b) => b.bets - a.bets);

  document.getElementById('odds-list').innerHTML = sorted.map((e, rank) => {
    const pct = Math.round(e.bets / totalBets * 100);
    return `<div class="odds-row">
      <div class="odds-name">${rank + 1}.</div>
      <div class="odds-bw"><div class="odds-b" style="width:${pct}%"></div></div>
      <div class="odds-pct">${pct}%</div>
      <div class="odds-cnt">${e.bets} bet</div>
    </div>`;
  }).join('');
}

export async function submitBet(showFn) {
  const name  = document.getElementById('bet-name').value.trim();
  const email = document.getElementById('bet-email').value.trim();
  const tel   = formatTel(document.getElementById('bet-tel').value.trim());
  if (!name||!email) { showErr('bet-err','Fyll i ditt namn och e-post.'); return; }
  if (!state.selectedPlayers.size) { showErr('bet-err','Välj minst 1 spelare.'); return; }

  const btn = document.getElementById('bet-sub-btn');
  if (btn.dataset.rateLimited || sessionStorage.getItem('bet-submitted')) { showErr('bet-err','Vänta innan du skickar igen.'); return; }
  btn.textContent='Kontrollerar...'; btn.disabled=true;
  btn.dataset.rateLimited = 'true';
  sessionStorage.setItem('bet-submitted', Date.now().toString());
  setTimeout(() => { delete btn.dataset.rateLimited; sessionStorage.removeItem('bet-submitted'); }, 5000);

  if (CFG.appsScriptUrl) {
    try {
      const r = await fetchWithTimeout(CFG.appsScriptUrl+'?action=checkBet&email='+encodeURIComponent(email)+'&namn='+encodeURIComponent(name));
      const d = await r.json();
      if (d.exists) { showErr('bet-err',d.meddelande||'Du har redan lagt ett bet.'); btn.textContent='Bekräfta & visa betalning'; btn.disabled=false; return; }
    } catch { /* network error — continue */ }
  }

  const players   = Array.from(state.selectedPlayers).map(idx => state.betPlayers[idx]?.name).filter(Boolean);
  const spelarids = Array.from(state.selectedPlayers).map(idx => state.betPlayers[idx]?.spelarid).filter(Boolean);
  const total = players.length * CFG.prisBetPerSpel;
  btn.textContent='Skickar...';
  try { if (CFG.appsScriptUrl) await fetchWithTimeout(CFG.appsScriptUrl,{method:'POST',body:JSON.stringify({action:'bet',namn:name,email:email,telefon:tel,spelare:players,spelarid:spelarids,totalbelopp:total,tidpunkt:new Date().toLocaleString('sv-SE')})}); } catch { /* network error */ }

  document.getElementById('bc-name').textContent = name.split(' ')[0];
  const swishBetLank = CFG.swishLankBet;
  document.getElementById('bc-pay').innerHTML = `
    <div class="pay-card">
      <div class="pay-head b"><div class="pay-head-ic">🎲</div><div class="pay-head-title">Betting-insats</div></div>
      <div class="pay-body">
        <div class="pay-row"><span class="pay-lbl">Dina spelare</span><span class="pay-val" style="font-size:12px;text-align:right">${players.map(n => escapeHtml(n)).join(', ')}</span></div>
        <div class="pay-row"><span class="pay-lbl">Belopp</span><span class="pay-val">${total} kr (${players.length} × ${CFG.prisBetPerSpel} kr)</span></div>
        <div class="pay-row"><span class="pay-lbl">Swisha till</span><span class="pay-val">${CFG.swishBetNr}</span></div>
        <div class="pay-row"><span class="pay-lbl">Märk med</span><span class="pay-tag">Bet ${escapeHtml(name)}</span></div>
        ${swishBetLank ? `<a href="${swishBetLank}" class="swish-btn"><span class="swish-btn-icon">💸</span>Öppna i Swish</a>` : ''}
      </div>
    </div>
    <div class="alert-box"><div class="alert-icon">📧</div><div class="alert-text">Bekräftelse skickas till din e-post.</div></div>`;

  btn.textContent='Bekräfta & visa betalning'; btn.disabled=false;
  state.selectedPlayers.clear();
  showFn('bet-confirm');
}
