import { CFG } from './config.js';
import { state } from './state.js';
import { formatTel, showErr, escapeHtml } from './utils.js';
import { photoKey, getLocalPhotos, saveLocalPhoto, uploadPhotoToDrive } from './photos.js';
import { fetchWithTimeout } from './fetch.js';

// -- CAPACITY --------------------------------------------------
export function updateCap(parts) {
  state.golfCnt = parts.filter(p=>p.pkg==='full'||p.pkg==='golf').length;
  state.festCnt = parts.filter(p=>p.pkg==='full'||p.pkg==='party').length;
  const gL = CFG.maxGolf - state.golfCnt, fL = CFG.maxFest - state.festCnt;
  const gP = Math.min(state.golfCnt/CFG.maxGolf*100,100);
  const fP = Math.min(state.festCnt/CFG.maxFest*100,100);

  const avRow  = document.getElementById('hf-avail-row');
  const capWrap = document.getElementById('hf-cap-wrap');
  const av = document.getElementById('hf-avail');
  const cb = document.getElementById('hf-cap-bar');
  if (state.golfCnt === 0) {
    avRow.style.display  = 'none';
    capWrap.style.display = 'none';
  } else {
    avRow.style.display  = '';
    capWrap.style.display = '';
    cb.style.width = gP + '%';
    if(gL>5){av.textContent=gL+' kvar';av.className='hf-val av';}
    else if(gL>0){av.textContent=gL+' kvar!';av.className='hf-val warn';}
    else{av.textContent='Fullbokad';av.className='hf-val full';}
  }

  setCapPill('cp-golf-bar','cp-golf-num',state.golfCnt,CFG.maxGolf,gL,gP);
  setCapPill('cp-fest-bar','cp-fest-num',state.festCnt,CFG.maxFest,fL,fP);
}

export function setCapPill(barId,numId,cnt,max,left,pct){
  const b = document.getElementById(barId);
  b.style.width = pct+'%';
  b.className = 'cp-bar '+(pct>=100?'cp-r':pct>=80?'cp-a':'cp-g');
  document.getElementById(numId).textContent = `${cnt}/${max} (${left>0?left+' kvar':'Fullbokad'})`;
}

// -- PACKAGES -------------------------------------------------
export function buildPkgs() {
  const pkgs = [
    {id:'full', ic:'⭐', nm:'Fullt paket', desc:'Golf + Middag & Midsommarfest. Den kompletta upplevelsen.', pris:CFG.prisFull, feat:true},
    {id:'golf', ic:'⛳', nm:'Endast Golf', desc:'Poängbogey-tävlingen utan kvällsevenemang.', pris:CFG.prisGolf, feat:false},
    {id:'party',ic:'🥂', nm:'Middag & Fest', desc:'Kvällsevenemang utan golf. För sällskap & inbjudna.', pris:CFG.prisFest, feat:false},
  ];
  document.getElementById('pkg-grid').innerHTML = pkgs.map(p =>
    `<div class="pkg-card ${p.feat?'feat':''}" data-action="show-reg">
      <div class="pkg-ic">${p.ic}</div><div class="pkg-name">${p.nm}</div>
      <div class="pkg-desc">${p.desc}</div>
      <div class="pkg-price">${p.pris.toLocaleString('sv-SE')} <span>kr</span></div>
      <button class="pkg-btn">Välj paket</button>
    </div>`
  ).join('');
  document.getElementById('p-opts').innerHTML = pkgs.map(p =>
    `<label class="p-opt" id="popt-${p.id}">
      <input type="radio" name="pkg" value="${p.id}" ${p.feat?'checked':''}>
      <div class="p-opt-inf"><div class="p-opt-n">${p.ic} ${p.nm}</div><div class="p-opt-s">${p.id==='full'?'En betalning för hela paketet':p.desc.split('.')[0]}</div></div>
      <div class="p-opt-p">${p.pris.toLocaleString('sv-SE')} kr</div>
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
    } catch { /* use fallback startlista */ }
  }

  const photos = getLocalPhotos();
  document.getElementById('startlista-grid').innerHTML = groups.map(g => `
    <div class="sg-card">
      <div class="sg-head"><span class="sg-name">${g.grupp}</span><span class="sg-time">⏱ Hål ${g.teeHal||1} · ${g.teeStart||''}</span></div>
      <div class="sg-body">${g.spelare.filter(n=>n).map(n=>{
        const sN = escapeHtml(n);
        const init = n.split(' ').map(w=>w[0]).join('').slice(0,2);
        const match = (state.betPlayers||[]).find(p=>p.name===n) || (state.allParts||[]).find(p=>p.name===n);
        const key = match ? photoKey(match) : n.toLowerCase();
        const ph = photos[key] || '';
        return `<div class="sg-player"><div class="sg-av">${ph?`<img src="${ph}" decoding="async">`:'<span>'+escapeHtml(init)+'</span>'}</div><div class="sg-pname">${sN}</div></div>`;
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
    const init = p.name.split(' ').map(w=>w[0]).join('').slice(0,2);
    const key  = photoKey(p);
    const ph   = photos[key] || '';
    return `<div class="golf-card">
      <div class="golf-photo">${ph
        ? `<img src="${ph}" alt="${sName}" loading="lazy" decoding="async">`
        : `<span>${escapeHtml(init)}</span>`
      }</div>
      <div class="golf-card-body">
        <div class="golf-card-name">${sName}</div>
        ${p.hcp&&p.hcp!=='—'?`<div class="golf-card-hcp">HCP ${escapeHtml(String(p.hcp))}</div>`:''}
        ${p.golfid&&p.golfid!=='—'?`<div class="golf-card-gid">Golf-ID: ${escapeHtml(p.golfid)}</div>`:''}
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

export async function handlePhoto(e, key) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async ev => {
    saveLocalPhoto(key, ev.target.result);
    renderGolfGrid();
    renderPlayers();
    buildStartlista();
    const driveUrl = await uploadPhotoToDrive(key, file);
    if (driveUrl) {
      renderGolfGrid();
      renderPlayers();
      buildStartlista();
    }
  };
  reader.readAsDataURL(file);
}

// -- PKG CHANGE ------------------------------------------------
export function pkgChange() {
  const v = document.querySelector('input[name=pkg]:checked')?.value;
  const isGolf = v !== 'party';
  document.getElementById('golfid-wrap').classList.toggle('show', isGolf);
  document.getElementById('hcp-wrap').classList.toggle('show', isGolf);
}

// -- SUBMIT REGISTRATION --------------------------------------
export async function submitReg(showFn) {
  const name  = document.getElementById('f-name').value.trim();
  const email = document.getElementById('f-email').value.trim();
  const tel   = formatTel(document.getElementById('f-tel').value.trim());
  const gid   = document.getElementById('f-golfid').value.trim();
  const hcp   = document.getElementById('f-hcp').value.trim();
  const allergy = document.getElementById('f-allergy').value.trim();
  if (!name||!email) { showErr('reg-err','Fyll i namn och e-post.'); return; }
  const pkg = document.querySelector('input[name=pkg]:checked')?.value;
  if ((pkg==='full'||pkg==='golf') && !gid) { showErr('reg-err','Golf-ID krävs för att delta i tävlingen.'); return; }
  if (gid && !/^\d{6}-\d{3}$/.test(gid)) { showErr('reg-err','Golf-ID ska ha formatet YYMMDD-NNN (t.ex. 760828-016).'); return; }

  const btn = document.getElementById('reg-btn');
  if (btn.dataset.rateLimited || sessionStorage.getItem('reg-submitted')) { showErr('reg-err','Vänta innan du skickar igen.'); return; }
  btn.textContent='Kontrollerar...'; btn.disabled=true;
  btn.dataset.rateLimited = 'true';
  sessionStorage.setItem('reg-submitted', Date.now().toString());
  setTimeout(() => { delete btn.dataset.rateLimited; sessionStorage.removeItem('reg-submitted'); }, 5000);

  if (CFG.appsScriptUrl) {
    try {
      const r = await fetchWithTimeout(CFG.appsScriptUrl+'?action=checkDuplikat&golfid='+encodeURIComponent(gid)+'&email='+encodeURIComponent(email)+'&namn='+encodeURIComponent(name));
      const d = await r.json();
      if (d.exists) { showErr('reg-err', d.meddelande||'Anmälan finns redan.'); btn.textContent='Skicka anmälan →'; btn.disabled=false; return; }
    } catch { /* network error — continue registration */ }
  }

  btn.textContent='Skickar...';
  const payload = {action:'anmalan',namn:name,email:email,telefon:tel,golfid:gid,handicap:hcp||'—',paket:pkg,allergier:allergy,tidpunkt:new Date().toLocaleString('sv-SE')};
  try { if (CFG.appsScriptUrl) await fetchWithTimeout(CFG.appsScriptUrl,{method:'POST',body:JSON.stringify(payload)}); } catch { /* network error */ }

  state.allParts.push({name,hcp:hcp||'—',golfid:gid||'—',bets:0,pkg});
  updateCap(state.allParts);
  document.getElementById('c-name').textContent = name.split(' ')[0];
  buildRegConfirm(name, pkg);
  btn.textContent='Skicka anmälan →'; btn.disabled=false;
  showFn('confirm');
}

export function buildRegConfirm(name, pkg) {
  const belopp = pkg==='full'?CFG.prisFull : pkg==='golf'?CFG.prisGolf : CFG.prisFest;
  const swishNr = pkg==='party' ? CFG.swishFest : CFG.swishGolf;
  const swishLank = pkg==='party' ? CFG.swishLankFest : CFG.swishLankGolf;
  const sName = escapeHtml(name);
  const mark = pkg==='full' ? sName+' Fullt' : pkg==='golf' ? sName+' Golf' : sName+' Fest';
  const ic = pkg==='party'?'🥂':'⛳';
  const titel = pkg==='full'?'Fullt paket (Golf + Middag & Fest)':pkg==='golf'?'Enbart Golf':'Middag & Fest';
  const cls = pkg==='party'?'p':'g';

  let h = `<div class="pay-card">
    <div class="pay-head ${cls}"><div class="pay-head-ic">${ic}</div><div class="pay-head-title">${titel}</div></div>
    <div class="pay-body">
      <div class="pay-row"><span class="pay-lbl">Belopp</span><span class="pay-val">${belopp.toLocaleString('sv-SE')} kr</span></div>
      <div class="pay-row"><span class="pay-lbl">Swisha till</span><span class="pay-val">${swishNr}</span></div>
      <div class="pay-row"><span class="pay-lbl">Märk med</span><span class="pay-tag">${mark}</span></div>
      ${swishLank ? `<a href="${swishLank}" class="swish-btn"><span class="swish-btn-icon">💸</span>Öppna i Swish</a>` : ''}
    </div>
  </div>`;
  document.getElementById('c-pays').innerHTML = h;
}

let _renderPlayers = null;
export function setRenderPlayers(fn) { _renderPlayers = fn; }
function renderPlayers() { if (_renderPlayers) _renderPlayers(); }
