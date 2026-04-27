import { CFG } from './config.js';
import { state } from './state.js';
import { formatTel, showErr, escapeHtml } from './utils.js';
import { photoKey, getLocalPhotos, saveLocalPhoto, uploadPhotoToDrive } from './photos.js';
import { fetchWithTimeout, postToAppsScript } from './fetch.js';

// -- CAPACITY --------------------------------------------------
export function updateCap(parts) {
  state.golfCnt  = parts.filter(p=>p.pkg==='full'||p.pkg==='golf').length;
  state.festCnt  = parts.filter(p=>p.pkg==='full'||p.pkg==='party').length;
  state.reservCnt = parts.filter(p=>p.pkg==='reserv').length;

  const gL = CFG.maxGolf       - state.golfCnt;
  const fL = CFG.maxFest       - state.festCnt;
  const rL = CFG.maxGolfReserv - state.reservCnt;

  const gP = Math.min(state.golfCnt/CFG.maxGolf*100, 100);
  const fP = Math.min(state.festCnt/CFG.maxFest*100, 100);

  const avRow   = document.getElementById('hf-avail-row');
  const capWrap = document.getElementById('hf-cap-wrap');
  const av = document.getElementById('hf-avail');
  const cb = document.getElementById('hf-cap-bar');
  if (state.golfCnt === 0) {
    avRow.style.display   = 'none';
    capWrap.style.display = 'none';
  } else {
    avRow.style.display   = '';
    capWrap.style.display = '';
    cb.style.width = gP + '%';
    if (gL>5)      { av.textContent=gL+' kvar';   av.className='hf-val av';   }
    else if (gL>0) { av.textContent=gL+' kvar!';  av.className='hf-val warn'; }
    else           { av.textContent='Fullbokad';   av.className='hf-val full'; }
  }

  setCapPill('cp-golf-bar','cp-golf-num',state.golfCnt,CFG.maxGolf,gL,gP);
  setCapPill('cp-fest-bar','cp-fest-num',state.festCnt,CFG.maxFest,fL,fP);

  _applyCapToCards(gL, fL, rL);
  _applyCapToOpts(gL, fL, rL);
}

export function setCapPill(barId, numId, cnt, max, left, pct) {
  const b = document.getElementById(barId);
  if (!b) return;
  b.style.width = pct + '%';
  b.className = 'cp-bar ' + (pct>=100 ? 'cp-r' : pct>=80 ? 'cp-a' : 'cp-g');
  document.getElementById(numId).textContent =
    `${cnt}/${max} (${left>0 ? left+' kvar' : 'Fullbokad'})`;
}

// Gråar ut / byter fullbokade paket-kort på startsidan
function _applyCapToCards(gL, fL, rL) {
  const grid = document.getElementById('pkg-grid');
  if (!grid) return;
  grid.querySelectorAll('.pkg-card').forEach(card => {
    const id = card.dataset.pkgId;
    const golfFull = gL <= 0 && (id === 'full' || id === 'golf');
    const festFull = fL <= 0 && (id === 'full' || id === 'party');
    const reservFull = rL <= 0 && id === 'reserv';
    const full = golfFull || festFull || reservFull;
    card.classList.toggle('pkg-full', full);
    const btn = card.querySelector('.pkg-btn');
    if (btn) {
      btn.textContent = full ? 'Fullbokad' : 'Välj paket';
      btn.disabled = full;
    }
    if (full) {
      card.removeAttribute('data-action');
      if (!card.querySelector('.pkg-full-badge')) {
        const badge = document.createElement('div');
        badge.className = 'pkg-full-badge';
        badge.textContent = 'Fullbokad';
        card.prepend(badge);
      }
    } else {
      card.dataset.action = 'show-reg';
      card.querySelector('.pkg-full-badge')?.remove();
    }
  });
}

// Inaktiverar fullbokade radio-alternativ i formuläret
function _applyCapToOpts(gL, fL, rL) {
  const opts = document.getElementById('p-opts');
  if (!opts) return;
  opts.querySelectorAll('.p-opt').forEach(label => {
    const input = label.querySelector('input[type=radio]');
    if (!input) return;
    const id = input.value;
    const golfFull  = gL <= 0 && (id === 'full' || id === 'golf');
    const festFull  = fL <= 0 && (id === 'party');
    const fullFull  = (gL <= 0 || fL <= 0) && id === 'full';
    const reservFull = rL <= 0 && id === 'reserv';
    const full = golfFull || festFull || fullFull || reservFull;
    input.disabled = full;
    label.classList.toggle('p-opt-disabled', full);
    let badge = label.querySelector('.p-opt-full');
    if (full && !badge) {
      badge = document.createElement('span');
      badge.className = 'p-opt-full';
      badge.textContent = 'Fullbokad';
      label.appendChild(badge);
    } else if (!full && badge) {
      badge.remove();
    }
    // Om valt alternativ blir fullbokat — välj bästa tillgängliga
    if (full && input.checked) {
      const fallback = opts.querySelector('input[value=party]:not(:disabled)')
        || opts.querySelector('input:not(:disabled)');
      if (fallback) { fallback.checked = true; pkgChange(); }
    }
  });
}

// -- PACKAGES -------------------------------------------------
export function buildPkgs() {
  const golfFull  = (CFG.maxGolf - (state.golfCnt||0)) <= 0;
  const reservFull = (CFG.maxGolfReserv - (state.reservCnt||0)) <= 0;

  // Bygg paket-listan dynamiskt beroende på kapacitet
  const pkgs = [];

  if (!golfFull) {
    // Golf fortfarande tillgängligt
    pkgs.push({ id:'full',  ic:'⭐', nm:'Fullt paket',   desc:'Golf + Middag & Midsommarfest. Den kompletta upplevelsen.', pris:CFG.prisFull,  feat:true  });
    pkgs.push({ id:'golf',  ic:'⛳', nm:'Endast Golf',    desc:'Slaggolf-tävlingen utan kvällsevenemang.',                 pris:CFG.prisGolf,  feat:false });
  } else if (!reservFull) {
    // Golf fullt — visa reservlista istället
    pkgs.push({ id:'reserv', ic:'📋', nm:'Reservlista Golf', desc:'Golf är fullbokat. Skriv upp dig på reservlistan — vi kontaktar dig om en plats öppnas.', pris:0, feat:true, isReserv:true });
  }

  pkgs.push({ id:'party', ic:'🥂', nm:'Middag & Fest', desc:'Kvällsevenemang utan golf. För sällskap & inbjudna.', pris:CFG.prisFest, feat:false });

  document.getElementById('pkg-grid').innerHTML = pkgs.map(p =>
    `<div class="pkg-card ${p.feat?'feat':''} ${p.isReserv?'pkg-reserv':''}" data-action="show-reg" data-pkg-id="${p.id}">
      <div class="pkg-ic">${p.ic}</div>
      <div class="pkg-name">${p.nm}</div>
      <div class="pkg-desc">${p.desc}</div>
      ${p.pris > 0
        ? `<div class="pkg-price">${p.pris.toLocaleString('sv-SE')} <span>kr</span></div>`
        : `<div class="pkg-price pkg-price-free">Gratis</div>`}
      ${p.id==='full' || p.id==='golf' ? `<div class="pkg-pott">🏆 Större delen av golf-avgiften går till prispotten</div>` : ''}
      <button class="pkg-btn">Välj paket</button>
    </div>`
  ).join('');

  document.getElementById('p-opts').innerHTML = pkgs.map(p =>
    `<label class="p-opt ${p.isReserv?'p-opt-reserv':''}" id="popt-${p.id}">
      <input type="radio" name="pkg" value="${p.id}" ${p.feat?'checked':''}>
      <div class="p-opt-inf">
        <div class="p-opt-n">${p.ic} ${p.nm}</div>
        <div class="p-opt-s">${p.id==='full' ? 'En betalning för hela paketet' : p.id==='reserv' ? 'Vi kontaktar dig om en plats öppnas' : p.desc.split('.')[0]}</div>
      </div>
      <div class="p-opt-p">${p.pris > 0 ? p.pris.toLocaleString('sv-SE')+' kr' : 'Gratis'}</div>
    </label>`
  ).join('');
}

// -- STARTLISTA ------------------------------------------------
export async function buildStartlista() {
  if (!CFG.visaStartlista) { document.getElementById('startlista-sec').style.display='none'; return; }
  document.getElementById('startlista-sec').style.display = 'block';

  let groups = CFG.startlista;
  if (CFG.appsScriptUrl) {
    try {
      const r = await fetchWithTimeout(CFG.appsScriptUrl + '?action=startlista');
      const d = await r.json();
      if (d && d.length) groups = d;
    } catch { /* use fallback */ }
  }

  const photos = getLocalPhotos();
  document.getElementById('startlista-grid').innerHTML = groups.map(g => `
    <div class="sg-card">
      <div class="sg-head">
        <span class="sg-name">${g.grupp}</span>
        <span class="sg-time">⏱ Hål ${g.teeHal||1} · ${g.teeStart||''}</span>
      </div>
      <div class="sg-body">${g.spelare.filter(n=>n).map(n => {
        const sN   = escapeHtml(n);
        const init = n.split(' ').map(w=>w[0]).join('').slice(0,2);
        const match = (state.betPlayers||[]).find(p=>p.name===n) || (state.allParts||[]).find(p=>p.name===n);
        const key   = match ? photoKey(match) : n.toLowerCase();
        const ph    = photos[key] || '';
        return `<div class="sg-player">
          <div class="sg-av">${ph ? `<img src="${ph}" decoding="async">` : '<span>'+escapeHtml(init)+'</span>'}</div>
          <div class="sg-pname">${sN}</div>
        </div>`;
      }).join('')}</div>
    </div>`
  ).join('');
}

// -- GOLF GRID -------------------------------------------------
export function renderGolfGrid() {
  const golfers = state.allParts.filter(p=>p.pkg==='full'||p.pkg==='golf');
  const cntWrap = document.getElementById('golf-cnt-wrap');
  const grid    = document.getElementById('golf-grid');

  if (!golfers.length) {
    cntWrap.style.display = 'none';
    grid.innerHTML = '';
    return;
  }

  document.getElementById('golf-cnt').textContent = golfers.length;
  cntWrap.style.display = 'block';

  const photos = getLocalPhotos();
  grid.innerHTML = golfers.map(p => {
    const sName = escapeHtml(p.name);
    const init  = p.name.split(' ').map(w=>w[0]).join('').slice(0,2);
    const key   = photoKey(p);
    const ph    = photos[key] || '';
    return `<div class="golf-card">
      <div class="golf-photo">${ph
        ? `<img src="${ph}" alt="${sName}" loading="lazy" decoding="async">`
        : `<span>${escapeHtml(init)}</span>`
      }</div>
      <div class="golf-card-body">
        <div class="golf-card-name">${sName}</div>
        ${p.hcp&&p.hcp!=='—' ? `<div class="golf-card-hcp">HCP ${escapeHtml(String(p.hcp))}</div>` : ''}
        ${p.golfid&&p.golfid!=='—' ? `<div class="golf-card-gid">Golf-ID: ${escapeHtml(p.golfid)}</div>` : ''}
        ${ph
          ? `<div class="photo-exists">✓ Foto uppladdad</div>`
          : `<div class="photo-up"><label class="photo-up-label">
               <input type="file" accept="image/*" data-photo-key="${key}">📷 Ladda upp foto
             </label></div>`
        }
      </div>
    </div>`;
  }).join('');
}

let _renderPlayersFn = null;
export function setRenderPlayers(fn) { _renderPlayersFn = fn; }

export async function handlePhoto(pid, file, renderGolfGridFn, renderPlayersFn) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async ev => {
    saveLocalPhoto(pid, ev.target.result);
    renderGolfGridFn();
    renderPlayersFn();
    buildStartlista();
    const driveUrl = await uploadPhotoToDrive(pid, file);
    if (driveUrl) {
      renderGolfGridFn();
      renderPlayersFn();
      buildStartlista();
    }
  };
  reader.readAsDataURL(file);
}

// -- PKG CHANGE ------------------------------------------------
export function pkgChange() {
  const v = document.querySelector('input[name=pkg]:checked')?.value;
  const isGolf = v === 'full' || v === 'golf';
  const isReserv = v === 'reserv';
  document.getElementById('golfid-wrap').classList.toggle('show', isGolf || isReserv);
  document.getElementById('hcp-wrap').classList.toggle('show', isGolf);
}

// -- SUBMIT REGISTRATION --------------------------------------
export async function submitReg(showFn) {
  const btn = document.getElementById('reg-btn');

  // Omedelbart disabled — förhindrar dubbelklick
  if (btn.disabled) return;
  btn.disabled = true;
  btn.textContent = 'Kontrollerar...';

  function resetBtn() {
    btn.disabled = false;
    btn.textContent = 'Skicka anmälan →';
  }

  const name    = document.getElementById('f-name').value.trim();
  const email   = document.getElementById('f-email').value.trim();
  const tel     = formatTel(document.getElementById('f-tel').value.trim());
  const gid     = document.getElementById('f-golfid').value.trim();
  const hcp     = document.getElementById('f-hcp').value.trim();
  const allergy = document.getElementById('f-allergy').value.trim();
  const pkg     = document.querySelector('input[name=pkg]:checked')?.value;

  if (!name||!email) { showErr('reg-err','Fyll i namn och e-post.'); resetBtn(); return; }

  // ── Kapacitetskontroll ────────────────────────────────────────
  const gL = CFG.maxGolf       - state.golfCnt;
  const fL = CFG.maxFest       - state.festCnt;
  const rL = CFG.maxGolfReserv - state.reservCnt;

  if ((pkg==='full'||pkg==='golf') && gL <= 0) {
    showErr('reg-err', 'Golf är fullbokat! Du kan skriva upp dig på reservlistan eller anmäla dig till Middag & Fest.');
    resetBtn(); return;
  }
  if ((pkg==='full'||pkg==='party') && fL <= 0) {
    showErr('reg-err', 'Tyvärr — Middag & Fest är fullbokat!');
    resetBtn(); return;
  }
  if (pkg==='reserv' && rL <= 0) {
    showErr('reg-err', 'Tyvärr — reservlistan är också full.');
    resetBtn(); return;
  }

  // Golf-ID krävs för golf och reserv
  if ((pkg==='full'||pkg==='golf'||pkg==='reserv') && !gid) {
    showErr('reg-err','Golf-ID krävs för att delta i tävlingen eller ställa sig i kön.');
    resetBtn(); return;
  }
  if (gid && !/^\d{6}-\d{3}$/.test(gid)) {
    showErr('reg-err','Golf-ID ska ha formatet YYMMDD-NNN (t.ex. 760828-016).');
    resetBtn(); return;
  }

  // ── Duplikatkontroll ─────────────────────────────────────────
  if (CFG.appsScriptUrl) {
    try {
      const r = await fetchWithTimeout(
        CFG.appsScriptUrl+'?action=checkDuplikat'+
        '&golfid='+encodeURIComponent(gid)+
        '&email='+encodeURIComponent(email)+
        '&namn='+encodeURIComponent(name)
      );
      const d = await r.json();
      if (d.exists) {
        showErr('reg-err', d.meddelande||'Anmälan finns redan.');
        resetBtn(); return;
      }
    } catch { /* network error — continue */ }
  }

  btn.textContent = 'Skickar...';

  const payload = {
    action:'anmalan', namn:name, email, telefon:tel,
    golfid:gid, handicap:hcp||'—', paket:pkg,
    allergier:allergy, tidpunkt:new Date().toLocaleString('sv-SE')
  };

  if (CFG.appsScriptUrl) {
    try {
      await postToAppsScript(CFG.appsScriptUrl, payload);
    } catch {
      showErr('reg-err',
        'Anmälan kunde inte skickas från den här webbläsaren. ' +
        'Öppna sidan i Safari eller Chrome och försök igen.'
      );
      resetBtn(); return;
    }
  }

  // Uppdatera lokal state (reservister räknas separat, visas ej i deltagarlistan)
  if (pkg !== 'reserv') {
    state.allParts.push({name, hcp:hcp||'—', golfid:gid||'—', bets:0, pkg});
  } else {
    state.reservCnt = (state.reservCnt||0) + 1;
  }
  updateCap(state.allParts);

  document.getElementById('c-name').textContent = name.split(' ')[0];
  buildRegConfirm(name, pkg);
  showFn('confirm');

  // Återaktivera knappen efter en stund ifall användaren går tillbaka
  setTimeout(() => { btn.disabled = false; btn.textContent = 'Skicka anmälan →'; }, 3000);
}

export function buildRegConfirm(name, pkg) {
  const isReserv = pkg === 'reserv';
  const belopp   = pkg==='full' ? CFG.prisFull : pkg==='golf' ? CFG.prisGolf : pkg==='party' ? CFG.prisFest : 0;
  const swishNr  = pkg==='party' ? CFG.swishFest : CFG.swishGolf;
  const swishLank = pkg==='party' ? CFG.swishLankFest : CFG.swishLankGolf;
  const sName = escapeHtml(name);
  const ic    = pkg==='party' ? '🥂' : pkg==='reserv' ? '📋' : '⛳';
  const titel = pkg==='full' ? 'Fullt paket (Golf + Middag & Fest)'
              : pkg==='golf' ? 'Enbart Golf'
              : pkg==='reserv' ? 'Reservlista Golf'
              : 'Middag & Fest';
  const mark  = pkg==='full' ? sName+' Fullt' : pkg==='golf' ? sName+' Golf' : pkg==='reserv' ? sName+' Reserv' : sName+' Fest';
  const cls   = pkg==='party' ? 'p' : pkg==='reserv' ? 'r' : 'g';

  let h;
  if (isReserv) {
    h = `<div class="pay-card">
      <div class="pay-head ${cls}"><div class="pay-head-ic">${ic}</div><div class="pay-head-title">${titel}</div></div>
      <div class="pay-body">
        <div class="reserv-info">
          <p>Du är nu uppsatt på reservlistan för golf. Vi kontaktar dig på <strong>${escapeHtml(document.getElementById('f-email')?.value||'')}</strong> om en plats öppnas.</p>
          <p style="margin-top:.5rem;font-size:13px;color:var(--muted)">Ingen betalning behövs nu.</p>
        </div>
      </div>
    </div>`;
  } else {
    h = `<div class="pay-card">
      <div class="pay-head ${cls}"><div class="pay-head-ic">${ic}</div><div class="pay-head-title">${titel}</div></div>
      <div class="pay-body">
        <div class="pay-row"><span class="pay-lbl">Belopp</span><span class="pay-val">${belopp.toLocaleString('sv-SE')} kr</span></div>
        <div class="pay-row"><span class="pay-lbl">Swisha till</span><span class="pay-val">${swishNr}</span></div>
        <div class="pay-row"><span class="pay-lbl">Märk med</span><span class="pay-tag">${mark}</span></div>
        ${swishLank
          ? `<a class="swish-btn" href="${escapeHtml(swishLank)}" target="_blank" rel="noopener noreferrer">
               <span class="swish-btn-icon">💸</span> Öppna Swish
             </a>`
          : ''}
      </div>
    </div>`;
  }

  document.getElementById('c-pays').innerHTML = h;
}