// ===============================================================
//  MIDSOMMARDAGSGOLFEN 2026 — Google Apps Script v13
//  Nytt i v13: doGet 'config' + doPost 'setConfig' — låter admin-panelen
//              toggla visaBetting / visaAnmalan i realtid (sparas i
//              Script Properties, ingen ny deploy av frontend behövs).
//  v12: skickaRegMail hanterar status 'Antagen' (reservist → golfare)
//       handleUpdateStatus lägger även till i Spelare-flik vid Antagen
// ===============================================================
const SWISH_GOLF   = '073-401 99 32';
const SWISH_FEST   = '073-401 99 32';
const SWISH_BET    = '073-427 48 41';
const PRIS_GOLF    = 500;
const PRIS_FEST    = 400;
const PRIS_FULL    = 900;
const PRIS_BET_PER = 30;
const SHEET_ID     = '';
const AVSANDARE    = 'Midsommardagsgolfen 2026';
const F_ANM = 'Anmälningar';
const F_SP  = 'Spelare';
const F_BET = 'Bets';
const CA = {tid:0,namn:1,email:2,tel:3,gid:4,hcp:5,paket:6,belopp:7,status:8,allergy:9};
const CS = {sid:0,namn:1,gid:2,hcp:3,grupp:4,anmald:5,erhallna:6,slagBrutto:7,slagNetto:8,poang:9};
const CB = {tid:0,namn:1,email:2,tel:3,spel:4,spelarid:5,antal:6,tot:7,status:8};

// Konfig-flaggor som kan togglas i realtid från admin-panelen.
const CONFIG_KEYS = ['visaBetting', 'visaAnmalan', 'visaStartlista', 'visaResultat'];

// Sheet-namn för score-funktionen
const F_LAG    = 'Lag';
const F_SCORE  = 'Scorecard';
const F_TAVLING = 'Tävling';

// ── ROUTER ──────────────────────────────────────────────────
function doPost(e) {
  try {
    // Stöd både form-POST (e.parameter.payload) och raw JSON (e.postData.contents)
    let raw = '';
    if (e.parameter && e.parameter.payload) {
      raw = e.parameter.payload;
    } else if (e.postData && e.postData.contents) {
      raw = e.postData.contents;
    }
    Logger.log('doPost raw: %s', raw.substring(0, 200));
    const d = JSON.parse(raw);
    if (d.action === 'anmalan')      return handleAnmalan(d);
    if (d.action === 'bet')          return handleBet(d);
    if (d.action === 'updateStatus') return handleUpdateStatus(d);
    if (d.action === 'sendMail')     return handleSendMail(d);
    if (d.action === 'uploadPhoto')  return handleUploadPhoto(d);
    if (d.action === 'updatePaket')  return handleUpdatePaket(d);
    if (d.action === 'setConfig')    return handleSetConfig(d);
    if (d.action === 'setTavling')   return handleSetTavling(d);
    if (d.action === 'sparaLag')     return handleSparaLag(d);
    if (d.action === 'raderaLag')    return handleRaderaLag(d);
    if (d.action === 'sattSignerad') return handleSattSignerad(d);
    if (d.action === 'sparaScore')   return handleSparaScore(d);
    if (d.action === 'signeraScore') return handleSigneraScore(d);
    return json({ok:true, msg:'Okänd action'});
  } catch(err) {
    Logger.log('doPost FEL: %s', String(err));
    return json({ok:false, fel:String(err)});
  }
}

function doGet(e) {
  const a = e.parameter.action || '';
  if (a==='config')        return json(hamtaConfig());
  if (a==='sparaScore') {
    try {
      const d = JSON.parse(e.parameter.payload || '{}');
      Logger.log('sparaScore via GET: pw=%s, spelare=%s', d.pw, (d.spelare||[]).length);
      return handleSparaScore(d);  // handleSparaScore returnerar redan json(...)
    } catch(err) {
      Logger.log('sparaScore GET parse-fel: %s', String(err));
      return json({ok:false, fel:String(err)});
    }
  }
  if (a==='lagLogin')      return json(handleLagLogin(e.parameter));
  if (a==='hamtaResultat') return json(hamtaResultat());
  if (a==='hamtaTavling')  return json(hamtaTavling());
  if (a==='hamtaLag')      return json(hamtaLagAdmin());
  if (a==='checkDuplikat') return json(checkDupAnm(e.parameter.golfid||'',e.parameter.email||'',e.parameter.namn||''));
  if (a==='checkBet')      return json(checkDupBet(e.parameter.email||'',e.parameter.namn||''));
  if (a==='spelare')       return json(hamtaSpelare());
  if (a==='deltagare')     return json(hamtaDeltagare());
  if (a==='startlista')    return json(hamtaStartlista());
  if (a==='adminData')     return json(hamtaAdminData());
  if (a==='sponsorbilder') return json(hamtaSponsorBilder(e.parameter.folderId||''));
  if (a==='spelarfoton')   return json(hamtaSpelarFoton(e.parameter.folderId||''));
  if (a==='logo')          return json(hamtaLogo(e.parameter.folderId||''));
  if (a==='uploadPhoto')   return handleUploadPhoto(e.parameter);
  if (a==='uploadChunk')   return handleUploadChunk(e.parameter);
  if (a==='raderaFoto')    return json(raderaFoto(e.parameter.namn||'', e.parameter.folderId||''));
  return json({ok:true});
}

// ── KONFIG (realtids-flaggor) ────────────────────────────────
// Läs flaggor. Osatt property → false (= dolt).
function hamtaConfig() {
  const props = PropertiesService.getScriptProperties();
  const out = {};
  CONFIG_KEYS.forEach(k => { out[k] = props.getProperty(k) === 'true'; });
  return out;
}

// Skriv en flagga. Kräver korrekt lösenord (Script Property ADMIN_PW).
function handleSetConfig(d) {
  const props = PropertiesService.getScriptProperties();
  const ADMIN_PW = props.getProperty('ADMIN_PW');
  if (!ADMIN_PW || d.pw !== ADMIN_PW) return json({ok:false, fel:'unauthorized'});
  if (CONFIG_KEYS.indexOf(d.key) === -1) return json({ok:false, fel:'okänd nyckel'});
  props.setProperty(d.key, d.value ? 'true' : 'false');
  return json({ok:true});
}

// ── CHUNK-BASERAD BILDUPPLADDNING ────────────────────────────
function handleUploadChunk(p) {
  try {
    const uploadId = p.uploadId || '';
    const chunk    = p.chunk    || '';
    const index    = parseInt(p.index  || '0');
    const total    = parseInt(p.total  || '1');
    const namn     = p.namn     || 'foto';
    const folderId = p.folderId || '';
    const mimeType = p.mimeType || 'image/jpeg';
    if (!uploadId || !folderId) return json({ok:false, fel:'Saknade parametrar'});
    const cache = CacheService.getScriptCache();
    cache.put(uploadId + '_' + index, chunk, 21600);
    if (index < total - 1) {
      return json({ok:true, received: index + 1, of: total});
    }
    const keys = [];
    for (let i = 0; i < total; i++) keys.push(uploadId + '_' + i);
    const allChunks = cache.getAll(keys);
    let b64 = '';
    for (let i = 0; i < total; i++) {
      const part = allChunks[uploadId + '_' + i];
      if (!part) return json({ok:false, fel:'Chunk ' + i + ' saknas i cache'});
      b64 += part;
    }
    cache.removeAll(keys);
    const folder   = DriveApp.getFolderById(folderId);
    const fileName = namn.replace(/\s+/g,'_') + '.jpg';
    const existing = folder.getFilesByName(fileName);
    while (existing.hasNext()) existing.next().setTrashed(true);
    const bytes = Utilities.base64Decode(b64);
    const blob  = Utilities.newBlob(bytes, mimeType, fileName);
    const file  = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return json({ok:true, url:'https://drive.google.com/thumbnail?id=' + file.getId() + '&sz=w400'});
  } catch(e) { return json({ok:false, fel:String(e)}); }
}

// ── DUPLIKAT ─────────────────────────────────────────────────
function checkDupAnm(golfid, email, namn) {
  const flik = ss().getSheetByName(F_ANM);
  if (!flik) return {exists:false};
  for (const r of flik.getDataRange().getValues().slice(1)) {
    if (aterbetald(r[CA.status])) continue;
    const harGolf = String(r[CA.paket]).toLowerCase().includes('golf') ||
                    String(r[CA.paket]).toLowerCase().includes('reserv');
    if (golfid && harGolf && eq(r[CA.gid], golfid))
      return {exists:true, meddelande:`Golf-ID ${golfid} är redan anmält.`};
    if (!golfid && eq(r[CA.email], email) && eq(r[CA.namn], namn))
      return {exists:true, meddelande:`En aktiv anmälan finns redan för ${namn} (${email}).`};
  }
  return {exists:false};
}

function checkDupBet(email, namn) {
  const flik = ss().getSheetByName(F_BET);
  if (!flik) return {exists:false};
  for (const r of flik.getDataRange().getValues().slice(1)) {
    if (aterbetald(r[CB.status])) continue;
    if (eq(r[CB.email],email) && eq(r[CB.namn],namn))
      return {exists:true, meddelande:`${namn} har redan lagt ett bet.`};
  }
  return {exists:false};
}

// ── SPELAR-ID ────────────────────────────────────────────────
function nextSpelarId(fSp) {
  const rows = fSp.getDataRange().getValues().slice(1);
  let max = 0;
  rows.forEach(r => {
    const sid = String(r[CS.sid]||'');
    const m = sid.match(/^S(\d+)$/);
    if (m) max = Math.max(max, parseInt(m[1]));
  });
  return 'S' + String(max + 1).padStart(3, '0');
}

// ── ANMÄLAN ──────────────────────────────────────────────────
function handleAnmalan(d) {
  const spreadsheet = ss();
  const fAnm = getOrCreate(spreadsheet, F_ANM,
    ['Tidpunkt','Namn','E-post','Telefon','Golf-ID','HCP','Paket','Belopp','Betalstatus','Allergier'],
    CA.status+1, CA.paket+1
  );
  const isReserv  = d.paket === 'reserv';
  const belopp    = isReserv ? 0 : d.paket==='full' ? PRIS_FULL : d.paket==='golf' ? PRIS_GOLF : PRIS_FEST;
  const status    = isReserv ? 'GolfReserv' : 'Obetald';
  const beloppStr = isReserv ? '0 kr' : belopp + ' kr';
  fAnm.appendRow([
    d.tidpunkt, d.namn, d.email, d.telefon||'—', d.golfid||'—',
    d.handicap||'—', paketNamn(d.paket), beloppStr, status, d.allergier||'—'
  ]);
  if (d.paket==='full' || d.paket==='golf') {
    const fSp = getOrCreate(spreadsheet, F_SP,
      ['SpelarID','Namn','Golf-ID','HCP','Grupp','Anmäld'], 0, 0);
    const sid = nextSpelarId(fSp);
    fSp.appendRow([sid, d.namn, d.golfid||'—', d.handicap||'—', '', d.tidpunkt]);
  }
  skickaRegMail(d, status);
  return json({ok:true});
}

// ── BET ──────────────────────────────────────────────────────
function handleBet(d) {
  const fBet = getOrCreate(ss(), F_BET,
    ['Tidpunkt','Namn','E-post','Telefon','Valda spelare','Spelar-ID:n','Antal','Totalt','Betalstatus'],
    CB.status+1, 0
  );
  const spelarNamn = Array.isArray(d.spelare)  ? d.spelare.join(', ')  : String(d.spelare||'');
  const spelarIds  = Array.isArray(d.spelarid) ? d.spelarid.join(', ') : String(d.spelarid||'');
  fBet.appendRow([
    d.tidpunkt, d.namn, d.email, d.telefon||'—',
    spelarNamn, spelarIds, d.spelare.length, d.totalbelopp+' kr', 'Obetald'
  ]);
  updateBetSummary(ss());
  skickaBetMail(d, 'Obetald');
  return json({ok:true});
}

function updateBetSummary(spreadsheet) {
  try {
    const fBet = spreadsheet.getSheetByName(F_BET);
    if (!fBet) return;
    const rows = fBet.getDataRange().getValues().slice(1);
    const counts = {};
    rows.forEach(r => {
      if (aterbetald(r[CB.status])) return;
      String(r[CB.spelarid]||'').split(',').forEach(sid => {
        const s = sid.trim();
        if (s) counts[s] = (counts[s]||0) + 1;
      });
    });
    const summaryData = [['SpelarID','Antal bets'], ...Object.entries(counts).sort((a,b)=>b[1]-a[1])];
    const startCol = 11;
    fBet.getRange(1,startCol,summaryData.length,2).setValues(summaryData);
    fBet.getRange(1,startCol,1,2).setBackground('#0c3318').setFontColor('#c9a84c').setFontWeight('bold');
  } catch(e) {}
}

// ── UPDATE STATUS ────────────────────────────────────────────
function handleUpdateStatus(d) {
  const spreadsheet = ss();
  const fName     = d.type==='anm' ? F_ANM : F_BET;
  const statusCol = d.type==='anm' ? CA.status+1 : CB.status+1;
  const flik = spreadsheet.getSheetByName(fName);
  if (!flik) return json({ok:false, msg:'Flik hittades ej'});
  const nyStatus = d.status;
  flik.getRange(d.id+2, statusCol).setValue(nyStatus);
  if (d.type === 'anm') {
    const row = flik.getDataRange().getValues()[d.id+1];
    // Reservist antagen → uppdatera paket + belopp + lägg till i Spelare-flik
    if (nyStatus === 'Antagen' || nyStatus === 'Obetald') {
      if (row && String(row[CA.paket]).toLowerCase().includes('reserv')) {
        const nyttPaket = d.paket === 'golf' ? 'Enbart Golf' : 'Golf + Middag & Fest';
        const nyttBelopp = d.paket === 'golf' ? PRIS_GOLF : PRIS_FULL;
        flik.getRange(d.id+2, CA.paket+1).setValue(nyttPaket);
        flik.getRange(d.id+2, CA.belopp+1).setValue(nyttBelopp + ' kr');
        const fSp = getOrCreate(spreadsheet, F_SP,
          ['SpelarID','Namn','Golf-ID','HCP','Grupp','Anmäld'], 0, 0);
        const existing = fSp.getDataRange().getValues().slice(1);
        const gidExists = existing.some(r => eq(r[CS.gid], row[CA.gid]));
        if (!gidExists) {
          const sid = nextSpelarId(fSp);
          fSp.appendRow([sid, row[CA.namn], row[CA.gid]||'—', row[CA.hcp]||'—', '', new Date().toLocaleString('sv-SE')]);
        }
      }
    }
    syncSpelareFlik(spreadsheet);
  }
  return json({ok:true});
}

// ── SEND MAIL ────────────────────────────────────────────────
function handleSendMail(d) {
  try {
    const status = d.status || 'Obetald';
    if (d.type === 'anm') {
      const flik = ss().getSheetByName(F_ANM);
      if (!flik) return json({ok:false, msg:'Flik saknas'});
      const row = flik.getDataRange().getValues()[d.id+1];
      if (!row) return json({ok:false, msg:'Rad ej funnen'});
      skickaRegMail({
        namn:row[CA.namn], email:row[CA.email], telefon:row[CA.tel]||'—',
        golfid:row[CA.gid]||'—', handicap:row[CA.hcp]||'—',
        paket:pkgKod(String(row[CA.paket])), allergier:row[CA.allergy]||'—',
        belopp:row[CA.belopp]
      }, status);
    } else {
      const flik = ss().getSheetByName(F_BET);
      if (!flik) return json({ok:false, msg:'Flik saknas'});
      const row = flik.getDataRange().getValues()[d.id+1];
      if (!row) return json({ok:false, msg:'Rad ej funnen'});
      skickaBetMail({
        namn:row[CB.namn], email:row[CB.email], telefon:row[CB.tel]||'—',
        spelare:String(row[CB.spel]).split(',').map(s=>s.trim()),
        totalbelopp:parseInt(String(row[CB.tot]))||0
      }, status);
    }
    return json({ok:true});
  } catch(e) { return json({ok:false, fel:String(e)}); }
}

// ── UPLOAD PHOTO ─────────────────────────────────────────────
function handleUploadPhoto(d) {
  try {
    if (!d.folderId || !d.base64 || !d.namn) return json({ok:false, fel:'Saknade parametrar'});
    const folder   = DriveApp.getFolderById(d.folderId);
    const mimeType = d.mimeType || 'image/jpeg';
    const fileName = d.namn.replace(/\s+/g,'_') + '.jpg';
    const existing = folder.getFilesByName(fileName);
    while (existing.hasNext()) existing.next().setTrashed(true);
    const blob = Utilities.newBlob(Utilities.base64Decode(d.base64), mimeType, fileName);
    const file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return json({ok:true, url:'https://drive.google.com/thumbnail?id='+file.getId()+'&sz=w400'});
  } catch(e) { return json({ok:false, fel:String(e)}); }
}

// ── SPONSOR BILDER ────────────────────────────────────────────
function hamtaSponsorBilder(folderId) {
  try {
    if (!folderId) return [];
    const folder = DriveApp.getFolderById(folderId);
    const files  = folder.getFiles();
    const result = [];
    while (files.hasNext()) {
      const f        = files.next();
      const fullName = f.getName();
      const mimeType = f.getMimeType() || '';
      if (!mimeType.startsWith('image/')) continue;
      const nameNoExt   = fullName.replace(/\.[^.]+$/, '');
      const namn        = nameNoExt.replace(/^\d+[_\-\s]+/, '').trim() || nameNoExt;
      const prefixMatch = fullName.match(/^(\d+)/);
      const sortKey     = prefixMatch ? parseInt(prefixMatch[1]) : 999;
      try {
        const blob = f.getBlob();
        result.push({ sortKey, namn, base64: Utilities.base64Encode(blob.getBytes()), mimeType: blob.getContentType() || 'image/png', webb: '' });
      } catch (fe) { Logger.log('Kunde inte läsa fil %s: %s', fullName, fe); }
    }
    return result
      .sort((a, b) => a.sortKey !== b.sortKey ? a.sortKey - b.sortKey : a.namn.localeCompare(b.namn))
      .map(({ sortKey, ...rest }) => rest);
  } catch (e) { Logger.log('hamtaSponsorBilder fel: %s', e); return []; }
}

// ── SPELARFOTON ──────────────────────────────────────────────
function hamtaSpelarFoton(folderId) {
  try {
    if (!folderId) return [];
    const folder = DriveApp.getFolderById(folderId);
    const nameToKey = {};
    try {
      const fSp = ss().getSheetByName(F_SP);
      if (fSp) {
        fSp.getDataRange().getValues().slice(1).forEach(r => {
          const namn = String(r[CS.namn]||'').toLowerCase().replace(/\s+/g,'_');
          const gid  = String(r[CS.gid]||'').toLowerCase();
          const sid  = String(r[CS.sid]||'').toLowerCase();
          if (!namn) return;
          if (gid && gid !== '—') {
            nameToKey[namn] = 'gid_' + gid;
          } else if (sid) {
            nameToKey[namn] = 'id_' + sid;
          } else {
            nameToKey[namn] = namn;
          }
        });
      }
    } catch(e) {
      Logger.log('hamtaSpelarFoton: kunde inte läsa Spelare-flik: %s', e);
    }
    const files  = folder.getFiles();
    const result = [];
    while (files.hasNext()) {
      const f        = files.next();
      const fileName = f.getName().replace(/\.[^.]+$/, '').toLowerCase();
      const key      = nameToKey[fileName] || fileName;
      const url      = 'https://drive.google.com/thumbnail?id=' + f.getId() + '&sz=w400';
      result.push({key, url});
    }
    return result;
  } catch(e) {
    Logger.log('hamtaSpelarFoton fel: %s', e);
    return [];
  }
}

// ── RADERA FOTO ──────────────────────────────────────────────
function raderaFoto(namn, folderId) {
  try {
    if (!namn || !folderId) return {ok:false, fel:'Saknade parametrar'};
    const folder = DriveApp.getFolderById(folderId);
    let count = 0;
    for (const ext of ['.jpg', '.jpeg']) {
      const fileName = namn.replace(/\s+/g, '_') + ext;
      const files    = folder.getFilesByName(fileName);
      while (files.hasNext()) { files.next().setTrashed(true); count++; }
    }
    return count > 0 ? {ok:true, raderade:count} : {ok:false, fel:'Ingen fil hittades: ' + namn};
  } catch(e) { return {ok:false, fel:String(e)}; }
}

// ── HÄMTA SPELARE ────────────────────────────────────────────
function hamtaSpelare() {
  const flik = ss().getSheetByName(F_SP);
  if (!flik) return [];
  const betById = {};
  try {
    const fBet = ss().getSheetByName(F_BET);
    if (fBet) {
      fBet.getDataRange().getValues().slice(1).forEach(r => {
        if (aterbetald(r[CB.status])) return;
        String(r[CB.spelarid]||'').split(',').forEach(sid => {
          const s = sid.trim();
          if (s) betById[s] = (betById[s]||0) + 1;
        });
      });
    }
  } catch(e) {}
  return flik.getDataRange().getValues().slice(1)
    .map(r => ({
      spelarid: String(r[CS.sid]||''),
      name:     String(r[CS.namn]),
      hcp:      r[CS.hcp],
      golfid:   String(r[CS.gid]),
      grupp:    String(r[CS.grupp]||''),
      bets:     betById[String(r[CS.sid]||'')] || 0
    }))
    .filter(p => p.name && p.name !== 'Namn');
}

// ── HÄMTA DELTAGARE ──────────────────────────────────────────
function hamtaDeltagare() {
  const flik = ss().getSheetByName(F_ANM);
  if (!flik) return [];
  return flik.getDataRange().getValues().slice(1)
    .filter(r => !aterbetald(r[CA.status]) && r[CA.status] !== 'GolfReserv')
    .map(r => ({
      name:   String(r[CA.namn]),
      pkg:    pkgKod(String(r[CA.paket])),
      golfid: String(r[CA.gid]||'—'),
      hcp:    String(r[CA.hcp]||'—')
    }))
    .filter(p => p.name);
}

// ── STARTLISTA ───────────────────────────────────────────────
function hamtaStartlista() {
  const flik = ss().getSheetByName(F_SP);
  if (!flik) return [];
  // Endast spelare som tilldelats en grupp visas på sidan.
  const rows   = flik.getDataRange().getValues().slice(1)
    .filter(r => r[CS.namn] && String(r[CS.grupp]||'').trim());
  const groups = {};
  rows.forEach(r => {
    const g = String(r[CS.grupp]).trim();
    if (!groups[g]) groups[g] = {grupp:g, teeStart:'', teeHal:'1', spelare:[]};
    groups[g].spelare.push(String(r[CS.namn]));
  });
  return Object.values(groups);
}

// ── HÄMTA LOGGA ──────────────────────────────────────────────
function hamtaLogo(folderId) {
  try {
    if (!folderId) return { ok: false };
    const folder = DriveApp.getFolderById(folderId);
    const files  = folder.getFilesByName('logo.jpg');
    if (!files.hasNext()) return { ok: false };
    const f   = files.next();
    const url = 'https://drive.google.com/thumbnail?id=' + f.getId() + '&sz=w200';
    return { ok: true, url: url };
  } catch(e) { return { ok: false, fel: String(e) }; }
}

// ── ADMIN DATA ───────────────────────────────────────────────
function hamtaAdminData() {
  const anm = [], bet = [];
  try {
    const fAnm = ss().getSheetByName(F_ANM);
    if (fAnm) {
      fAnm.getDataRange().getValues().slice(1).forEach((r,i) => {
        const status = String(r[CA.status]||'').trim();
        if (!status) return;
        anm.push({id:i, namn:String(r[CA.namn]), email:String(r[CA.email]),
          telefon:String(r[CA.tel]||'—'),
          paket:String(r[CA.paket]), belopp:String(r[CA.belopp]), status});
      });
    }
  } catch(e) {}
  try {
    const fBet = ss().getSheetByName(F_BET);
    if (fBet) {
      fBet.getDataRange().getValues().slice(1).forEach((r,i) => {
        const status = String(r[CB.status]||'').trim();
        if (!status) return;
        bet.push({id:i, namn:String(r[CB.namn]), email:String(r[CB.email]),
          telefon:String(r[CB.tel]||'—'),
          spelare:String(r[CB.spel]), belopp:String(r[CB.tot]), status});
      });
    }
  } catch(e) {}
  return {anm, bet};
}

// ── SYNC SPELARE-FLIK ────────────────────────────────────────
function syncSpelareFlik(spreadsheet) {
  const fAnm = spreadsheet.getSheetByName(F_ANM);
  const fSp  = getOrCreate(spreadsheet, F_SP,
    ['SpelarID','Namn','Golf-ID','HCP','Grupp','Anmäld'], 0, 0);
  if (!fAnm) return;
  const existing = new Set(
    fSp.getDataRange().getValues().slice(1).map(r => String(r[CS.gid]).toLowerCase())
  );
  const aktiva = fAnm.getDataRange().getValues().slice(1).filter(r =>
    !aterbetald(r[CA.status]) &&
    r[CA.status] !== 'GolfReserv' &&
    String(r[CA.paket]).toLowerCase().includes('golf')
  );
  aktiva.forEach(r => {
    const gid = String(r[CA.gid]||'').toLowerCase();
    if (!existing.has(gid)) {
      const sid = nextSpelarId(fSp);
      fSp.appendRow([sid, r[CA.namn], r[CA.gid]||'—', r[CA.hcp]||'—', '', r[CA.tid]]);
      existing.add(gid);
    }
  });
}

function onEdit(e) {
  const sh  = e.source.getActiveSheet();
  const col = e.range.getColumn(), row = e.range.getRow();
  if (row < 2) return;
  if (sh.getName()===F_ANM && col===CA.status+1) {
    const nyStatus = String(e.value||'').trim();
    if (nyStatus === 'Obetald') {
      const rowData = sh.getRange(row, 1, 1, 10).getValues()[0];
      if (String(rowData[CA.paket]).toLowerCase().includes('reserv')) {
        sh.getRange(row, CA.paket+1).setValue('Golf + Middag & Fest');
        sh.getRange(row, CA.belopp+1).setValue(PRIS_FULL + ' kr');
      }
    }
    syncSpelareFlik(e.source);
  }
  if (sh.getName()===F_BET) updateBetSummary(e.source);
}

// ── MAIL ─────────────────────────────────────────────────────
function skickaRegMail(d, status) {
  const p = d.paket;
  // ── Reservlista-bekräftelse ───────────────────────────────
  if (p === 'reserv' || status === 'GolfReserv') {
    const subject = 'Reservlista bekräftad — Midsommardagsgolfen 2026';
    const body = statusBanner('reserv', 'Du är uppsatt på reservlistan',
      'Golf är fullbokat, men vi har lagt till dig på reservlistan. Vi kontaktar dig direkt om en plats öppnas.')
      + `<table style="margin-top:16px;font-size:13px;color:#4a6a54;border-collapse:collapse;width:100%">
           <tr><td style="padding:6px 0;border-bottom:1px solid #eee;font-weight:600;width:110px">Datum</td>
               <td style="padding:6px 0;border-bottom:1px solid #eee">Lördag 20 Juni 2026</td></tr>
           <tr><td style="padding:6px 0;font-weight:600">Plats</td>
               <td style="padding:6px 0">Rya Golfklubb, Helsingborg</td></tr>
         </table>
         <p style="font-size:13px;color:#888;margin-top:16px">Ingen betalning behövs nu. Du hör från oss om en plats blir ledig.</p>`;
    mail(d.email, subject, mailSkal(d.namn, body));
    return;
  }
  // ── Påminnelse om betalning ───────────────────────────────
  if (status === 'Påminnelse') {
    const belopp  = p==='full' ? PRIS_FULL : p==='golf' ? PRIS_GOLF : PRIS_FEST;
    const swishNr = p==='party' ? SWISH_FEST : SWISH_GOLF;
    const mark    = p==='full' ? d.namn+' Fullt' : p==='golf' ? d.namn+' Golf' : d.namn+' Fest';
    const titel   = p==='full' ? 'Fullt paket (Golf + Middag &amp; Fest)'
                  : p==='golf' ? 'Tävlingsavgift Golf'
                  : 'Middag &amp; Midsommarfest';
    const ic = p==='party' ? '&#127870;' : '&#9971;';
    const subject = 'Påminnelse: Betalning saknas — Midsommardagsgolfen 2026';
    const body = statusBanner('paminnelse', 'Din betalning saknas',
      'Vi har noterat att din betalning inte kommit in än. Swisha gärna så snart som möjligt för att säkra din plats.')
      + betalKort(ic, titel, belopp + ' kr', swishNr, mark);
    mail(d.email, subject, mailSkal(d.namn, body));
    return;
  }
  // ── NYTT: Antagen från reservlistan ──────────────────────
  if (status === 'Antagen') {
    const subject = '⛳ Grattis — du är antagen till Midsommardagsgolfen 2026!';
    const body = statusBanner('antagen', 'Du har fått en plats!',
      'En plats har öppnats och du är nu antagen från reservlistan. Välkommen till banan!')
      + betalKort('&#9971;',
        d.paket === 'golf' ? 'Enbart Golf' : 'Fullt paket (Golf + Middag &amp; Fest)',
        (d.paket === 'golf' ? PRIS_GOLF : PRIS_FULL) + ' kr',
        SWISH_GOLF,
        d.namn + ' Golf')
      + `<div style="background:#f0faf3;border-radius:10px;padding:16px;border:1px solid #c8e6c9;margin-top:16px">
           <table style="font-size:13px;color:#4a6a54;border-collapse:collapse;width:100%">
             <tr><td style="padding:6px 0;border-bottom:1px solid #d4ead9;font-weight:600;width:110px">Datum</td>
                 <td style="padding:6px 0;border-bottom:1px solid #d4ead9">Lördag 20 Juni 2026</td></tr>
             <tr><td style="padding:6px 0;border-bottom:1px solid #d4ead9;font-weight:600">Plats</td>
                 <td style="padding:6px 0;border-bottom:1px solid #d4ead9">Rya Golfklubb, Helsingborg</td></tr>
             <tr><td style="padding:6px 0;font-weight:600">Slagstart</td>
                 <td style="padding:6px 0">10:00</td></tr>
           </table>
         </div>
         <p style="font-size:13px;color:#c0392b;font-weight:600;margin-top:16px;background:#fdecea;padding:12px 16px;border-radius:8px;border-left:4px solid #e74c3c">
           ⏳ Betala senast inom 48 timmar för att behålla platsen — annars erbjuds den vidare till nästa på reservlistan.
         </p>`;
    mail(d.email, subject, mailSkal(d.namn, body));
    return;
  }
  // ── Standardfall: betald, återbetald, ny anmälan ─────────
  const belopp  = p==='full' ? PRIS_FULL : p==='golf' ? PRIS_GOLF : PRIS_FEST;
  const swishNr = p==='party' ? SWISH_FEST : SWISH_GOLF;
  const mark    = p==='full'  ? d.namn+' Fullt' : p==='golf' ? d.namn+' Golf' : d.namn+' Fest';
  const titel   = p==='full'  ? 'Fullt paket (Golf + Middag &amp; Fest)'
                : p==='golf'  ? 'Tävlingsavgift Golf'
                : 'Middag &amp; Midsommarfest';
  const ic = p==='party' ? '&#127870;' : '&#9971;';
  let subject, body;
  if (status === 'Betald') {
    subject = 'Betalning bekräftad — Midsommardagsgolfen 2026';
    body = statusBanner('bekraftad', 'Betalning mottagen', 'Din anmälan är nu fullt bekräftad.')
      + kvittoKort(ic, titel, belopp + ' kr', mark)
      + `<table style="margin-top:20px;font-size:13px;color:#4a6a54;border-collapse:collapse;width:100%">
           <tr><td style="padding:6px 0;border-bottom:1px solid #eee;font-weight:600;width:110px">Datum</td>
               <td style="padding:6px 0;border-bottom:1px solid #eee">Lördag 20 Juni 2026</td></tr>
           <tr><td style="padding:6px 0;border-bottom:1px solid #eee;font-weight:600">Plats</td>
               <td style="padding:6px 0;border-bottom:1px solid #eee">Rya Golfklubb, Helsingborg</td></tr>
           ${p!=='party' ? '<tr><td style="padding:6px 0;border-bottom:1px solid #eee;font-weight:600">Slagstart</td><td style="padding:6px 0;border-bottom:1px solid #eee">10:00</td></tr>' : ''}
           ${p!=='golf'  ? '<tr><td style="padding:6px 0;font-weight:600">Middag</td><td style="padding:6px 0">19:30</td></tr>' : ''}
         </table>`;
  } else if (status === 'Återbetald') {
    subject = 'Återbetalning — Midsommardagsgolfen 2026';
    body = statusBanner('aterbetald', 'Återbetalning behandlad', 'Din anmälan har avbokats och återbetalning är genomförd.')
      + `<div style="border-radius:10px;overflow:hidden;border:1px solid #ffe082">
           <div style="background:#fff8e1;padding:12px 16px;font-weight:700;font-size:14px;color:#f57f17;border-bottom:1px solid #ffe082">${ic}&nbsp; ${titel}</div>
           <div style="padding:14px 16px;background:#fff">
             <table style="font-size:13px;width:100%;border-collapse:collapse">
               <tr><td style="color:#6a917a;padding:6px 0;border-bottom:1px solid #f5f5f5">Återbetalat belopp</td>
                   <td style="text-align:right;font-weight:700;font-size:16px;color:#f57f17;border-bottom:1px solid #f5f5f5">${belopp} kr</td></tr>
               <tr><td style="color:#6a917a;padding:6px 0">Avser</td>
                   <td style="text-align:right;padding:6px 0">
                     <span style="background:#f57f17;color:#fff;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:700">${mark}</span>
                   </td></tr>
             </table>
           </div>
         </div>
         <p style="font-size:13px;color:#888;margin-top:16px">Har du frågor? Kontakta arrangören.</p>`;
  } else {
    subject = 'Anmälan mottagen — Midsommardagsgolfen 2026';
    body = `<p style="color:#2a4a34;font-size:14px;margin:0 0 20px;line-height:1.7">
              Din anmälan är registrerad. Genomför betalning nedan för att säkra din plats.
            </p>`
      + betalKort(ic, titel, belopp + ' kr', swishNr, mark);
  }
  mail(d.email, subject, mailSkal(d.namn, body));
}

function skickaBetMail(d, status) {
  const tot = d.totalbelopp || (Array.isArray(d.spelare) ? d.spelare.length * PRIS_BET_PER : 0);
  const spelareLista = (Array.isArray(d.spelare)
    ? d.spelare
    : String(d.spelare||'').split(',').map(s => s.trim())
  ).map(s =>
    `<tr><td style="padding:5px 0;font-size:13px;color:#1b5e34;border-bottom:1px solid #d4ead9">
       <span style="color:#c9a84c;margin-right:6px;font-weight:700">&#8250;</span>${s}
     </td></tr>`
  ).join('');
  if (status === 'Påminnelse') {
    const subject = 'Påminnelse: Betalning saknas — Midsommardagsgolfen 2026';
    const body = statusBanner('paminnelse', 'Din bet-betalning saknas',
      'Vi har noterat att din betalning inte kommit in. Swisha gärna så snart som möjligt för att delta i potten.')
      + betalKort('&#127922;', 'Betting-insats', tot + ' kr', SWISH_BET, 'Bet ' + d.namn)
      + `<div style="background:#f0faf3;border-radius:10px;padding:16px;border:1px solid #c8e6c9;margin-top:12px">
           <div style="font-weight:700;font-size:14px;color:#1a5c32;margin-bottom:10px">Dina valda spelare</div>
           <table style="width:100%;border-collapse:collapse">${spelareLista}</table>
         </div>`;
    mail(d.email, subject, mailSkal(d.namn, body));
    return;
  }
  let subject, body;
  if (status === 'Betald') {
    subject = 'Bet bekräftat — Midsommardagsgolfen 2026';
    body = statusBanner('bekraftad', 'Bet bekräftat', 'Lycka till i tävlingen!')
      + kvittoKort('&#127922;', 'Betting-insats', tot + ' kr', 'Bet ' + d.namn)
      + `<div style="background:#f0faf3;border-radius:10px;padding:16px;border:1px solid #c8e6c9;margin-top:12px">
           <div style="font-weight:700;font-size:14px;color:#1a5c32;margin-bottom:10px">Dina valda spelare</div>
           <table style="width:100%;border-collapse:collapse">${spelareLista}</table>
         </div>`;
  } else if (status === 'Återbetald') {
    subject = 'Bet återbetalat — Midsommardagsgolfen 2026';
    body = statusBanner('aterbetald', 'Bet återbetalat', 'Ditt bet har annullerats och insatsen återbetalas.')
      + `<div style="border-radius:10px;overflow:hidden;border:1px solid #ffe082">
           <div style="background:#fff8e1;padding:12px 16px;font-weight:700;font-size:14px;color:#f57f17">&#127922;&nbsp; Betting-insats</div>
           <div style="padding:14px 16px;background:#fff">
             <table style="font-size:13px;width:100%;border-collapse:collapse">
               <tr><td style="color:#6a917a;padding:6px 0">Återbetalat</td>
                   <td style="text-align:right;font-weight:700;font-size:16px;color:#f57f17">${tot} kr</td></tr>
             </table>
           </div>
         </div>`;
  } else {
    subject = 'Bet registrerat — betalning saknas — Midsommardagsgolfen 2026';
    body = `<p style="color:#2a4a34;font-size:14px;margin:0 0 16px;line-height:1.7">
              Ditt bet är registrerat! Swisha insatsen nedan för att delta i potten.
            </p>
            <div style="background:#fdecea;border:1px solid #e6a99f;border-radius:10px;padding:14px 16px;margin:0 0 20px">
              <div style="font-weight:700;font-size:14px;color:#9c2c1e;margin-bottom:4px">&#9888;&#65039;&nbsp; Ditt bet gäller först när betalningen är erlagd</div>
              <div style="font-size:13px;color:#9c2c1e;line-height:1.6">Swisha insatsen nedan så är du med i potten. Tills betalningen kommit in räknas inte ditt bet.</div>
            </div>`
      + betalKort('&#127922;', 'Betting-insats', tot + ' kr', SWISH_BET, 'Bet ' + d.namn)
      + `<div style="background:#f0faf3;border-radius:10px;padding:16px;border:1px solid #c8e6c9;margin-top:12px">
           <div style="font-weight:700;font-size:14px;color:#1a5c32;margin-bottom:10px">Dina valda spelare</div>
           <table style="width:100%;border-collapse:collapse">${spelareLista}</table>
         </div>`
      + `<div style="background:#fff;border:1px solid #d4ead9;border-radius:10px;padding:16px;margin-top:12px">
           <div style="font-weight:700;font-size:14px;color:#1a5c32;margin-bottom:8px">Så funkar potten</div>
           <table style="width:100%;border-collapse:collapse;font-size:13px;color:#2a4a34">
             <tr><td style="padding:4px 0"><span style="color:#c9a84c;margin-right:6px;font-weight:700">&#8250;</span>${PRIS_BET_PER} kr per bet (1 bet = 1 spelare)</td></tr>
             <tr><td style="padding:4px 0"><span style="color:#c9a84c;margin-right:6px;font-weight:700">&#8250;</span>Max 5 bet per person</td></tr>
             <tr><td style="padding:4px 0"><span style="color:#c9a84c;margin-right:6px;font-weight:700">&#8250;</span>30 % av potten går till vinnaren, 70 % delas bland bettarna</td></tr>
           </table>
         </div>`;
  }
  mail(d.email, subject, mailSkal(d.namn, body));
}

function mail(to, subject, html) {
  GmailApp.sendEmail(to, subject, '', {htmlBody: html, name: AVSANDARE});
}

// ── MAIL BYGGBLOCK ───────────────────────────────────────────
function mailSkal(namn, body) {
  return `<!DOCTYPE html>
<html lang="sv">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#edeae3;font-family:Georgia,'Times New Roman',serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#edeae3;padding:32px 16px">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%">
        <tr><td style="background:#0c3318;border-radius:14px 14px 0 0;padding:30px 32px;text-align:center;border-bottom:3px solid #c9a84c">
          <div style="font-size:32px;margin-bottom:10px">&#9971;</div>
          <div style="font-family:Georgia,serif;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:0.5px;margin-bottom:6px">Midsommardagsgolfen 2026</div>
          <div style="color:#c9a84c;font-size:12px;letter-spacing:2px;text-transform:uppercase">Rya GK &nbsp;&middot;&nbsp; 20 Juni 2026</div>
        </td></tr>
        <tr><td style="background:#ffffff;padding:30px 32px;border-left:1px solid #ddd6cc;border-right:1px solid #ddd6cc">
          <p style="font-family:Georgia,serif;font-size:19px;color:#0a1f10;margin:0 0 22px;font-weight:700">Hej ${namn},</p>
          ${body}
        </td></tr>
        <tr><td style="background:#0c3318;border-radius:0 0 14px 14px;padding:16px;text-align:center;border-top:1px solid #1a4a28">
          <div style="color:#c9a84c;font-size:11px;letter-spacing:1.5px;text-transform:uppercase">Midsommardagsgolfen 2026 &nbsp;&middot;&nbsp; Rya Golfklubb, Helsingborg</div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function statusBanner(typ, rubrik, text) {
  const stilar = {
    bekraftad:  { bg:'#d4edda', border:'#28a745', rubrikFarg:'#155724', textFarg:'#1e7e34' },
    aterbetald: { bg:'#fff3cd', border:'#ffc107', rubrikFarg:'#856404', textFarg:'#6d5103' },
    paminnelse: { bg:'#fff3cd', border:'#ffc107', rubrikFarg:'#856404', textFarg:'#6d5103' },
    reserv:     { bg:'#e3f2fd', border:'#1976d2', rubrikFarg:'#0d47a1', textFarg:'#1565c0' },
    antagen:    { bg:'#e8f5e9', border:'#2e7d32', rubrikFarg:'#1b5e20', textFarg:'#2e7d32' },
    obetald:    { bg:'#f8d7da', border:'#dc3545', rubrikFarg:'#721c24', textFarg:'#842029' }
  };
  const s = stilar[typ] || stilar.obetald;
  return `<div style="background:${s.bg};border-left:4px solid ${s.border};border-radius:0 10px 10px 0;padding:16px 20px;margin-bottom:22px">
    <div style="font-weight:700;color:${s.rubrikFarg};font-size:16px;margin-bottom:4px">${rubrik}</div>
    <div style="color:${s.textFarg};font-size:13px;line-height:1.5">${text}</div>
  </div>`;
}

function betalKort(ic, titel, belopp, swish, mark) {
  return `<div style="border-radius:10px;overflow:hidden;margin-bottom:16px;border:1px solid #c8ddc8">
    <div style="background:#e8f5e9;padding:13px 16px;font-weight:700;font-size:14px;color:#1a4a28;border-bottom:1px solid #c8ddc8">${ic}&nbsp; ${titel}</div>
    <div style="padding:14px 16px;background:#fff">
      <table style="font-size:13px;width:100%;border-collapse:collapse">
        <tr><td style="color:#6a917a;padding:7px 0;border-bottom:1px solid #f0f0f0">Belopp att swisha</td>
            <td style="text-align:right;font-weight:700;font-size:18px;color:#0c3318;border-bottom:1px solid #f0f0f0">${belopp}</td></tr>
        <tr><td style="color:#6a917a;padding:7px 0;border-bottom:1px solid #f0f0f0">Swisha till</td>
            <td style="text-align:right;font-weight:600;font-family:'Courier New',monospace;font-size:14px;color:#0c3318;border-bottom:1px solid #f0f0f0">${swish}</td></tr>
        <tr><td style="color:#6a917a;padding:7px 0">Märk betalningen</td>
            <td style="text-align:right;padding:7px 0">
              <span style="background:#0c3318;color:#c9a84c;padding:4px 14px;border-radius:20px;font-size:12px;font-weight:700">${mark}</span>
            </td></tr>
      </table>
    </div>
  </div>`;
}

function kvittoKort(ic, titel, belopp, mark) {
  return `<div style="border-radius:10px;overflow:hidden;margin-bottom:16px;border:1px solid #a8d5b5">
    <div style="background:#1a5c32;padding:13px 16px;font-weight:700;font-size:14px;color:#e8f5e9;border-bottom:1px solid #a8d5b5">${ic}&nbsp; Kvitto &mdash; ${titel}</div>
    <div style="padding:14px 16px;background:#fff">
      <table style="font-size:13px;width:100%;border-collapse:collapse">
        <tr><td style="color:#6a917a;padding:7px 0;border-bottom:1px solid #f0f0f0">Betalt belopp</td>
            <td style="text-align:right;font-weight:700;font-size:20px;color:#1a5c32;border-bottom:1px solid #f0f0f0">${belopp}</td></tr>
        <tr><td style="color:#6a917a;padding:7px 0">Avser</td>
            <td style="text-align:right;padding:7px 0">
              <span style="background:#1a5c32;color:#ffffff;padding:4px 14px;border-radius:20px;font-size:12px;font-weight:700">${mark}</span>
            </td></tr>
      </table>
    </div>
  </div>`;
}

// ── UTILS ────────────────────────────────────────────────────
function ss()          { return SHEET_ID ? SpreadsheetApp.openById(SHEET_ID) : SpreadsheetApp.getActiveSpreadsheet(); }
function eq(a,b)       { return String(a).trim().toLowerCase() === String(b).trim().toLowerCase(); }
function aterbetald(s) { return String(s||'').trim().toLowerCase() === 'återbetald'; }
function paketNamn(p)  { return {full:'Golf + Middag & Fest', golf:'Enbart Golf', party:'Enbart Fest', reserv:'Reservlista Golf'}[p] || p; }
function pkgKod(s)     { s=s.toLowerCase(); return s.includes('reserv')?'reserv':s.includes('golf')&&s.includes('fest')?'full':s.includes('golf')?'golf':'party'; }

function getOrCreate(spreadsheet, namn, headers, statusCol, paketCol) {
  let flik = spreadsheet.getSheetByName(namn);
  if (!flik) {
    flik = spreadsheet.insertSheet(namn);
    flik.appendRow(headers);
    flik.getRange(1,1,1,headers.length).setBackground('#0c3318').setFontColor('#c9a84c').setFontWeight('bold');
    flik.setFrozenRows(1);
    if (statusCol > 0) {
      const sr = flik.getRange(2, statusCol, 1000, 1);
      sr.setDataValidation(SpreadsheetApp.newDataValidation()
        .requireValueInList(['Obetald','Betald','Återbetald','GolfReserv','Antagen'], true).build());
      flik.setConditionalFormatRules([
        SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('Betald').setBackground('#c8e6c9').setRanges([sr]).build(),
        SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('Återbetald').setBackground('#fff9c4').setRanges([sr]).build(),
        SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('Obetald').setBackground('#ffcdd2').setRanges([sr]).build(),
        SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('GolfReserv').setBackground('#e3f2fd').setRanges([sr]).build(),
        SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('Antagen').setBackground('#fff3e0').setRanges([sr]).build(),
      ]);
    }
    if (paketCol > 0) {
      flik.getRange(2, paketCol, 1000, 1).setDataValidation(SpreadsheetApp.newDataValidation()
        .requireValueInList(['Golf + Middag & Fest','Enbart Golf','Enbart Fest','Reservlista Golf'], true).build());
    }
  }
  return flik;
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function handleUpdatePaket(d) {
  const flik = ss().getSheetByName(F_ANM);
  if (!flik) return json({ok:false});
  const belopp = d.belopp || 0;
  flik.getRange(d.id+2, CA.paket+1).setValue(d.paket);
  flik.getRange(d.id+2, CA.belopp+1).setValue(belopp + ' kr');
  return json({ok:true});
}

// ── SCORE / LAG / RESULTAT ───────────────────────────────────
//
// Lag-sheet:     Lagnamn | Losenord | Grupp | Signerad
// Spelare-sheet: SpelarID | Namn | Golf-ID | HCP | Grupp | Anmäld | Erhållna Slag | Slag Brutto | Slag Netto | Poäng
// Scorecard:     Tid | Lag | Spelare | Erhallna | Slag1..18 | Poang1..18 | Totalpoang
//
// Lag-sheetet används BARA för lösenord + gruppreferens.
// Spelarna hämtas från Spelare-sheetet via Grupp-kolumnen.

// ── LAG ADMIN: läsa, spara, radera ──────────────────────────────
function authAdmin(d) {
  const pw = PropertiesService.getScriptProperties().getProperty('ADMIN_PW');
  return pw && d.pw === pw;
}

function hamtaLagAdmin() {
  const flik = ss().getSheetByName(F_LAG);
  if (!flik) return [];
  const rows = flik.getDataRange().getValues();
  const result = [];
  for (let i = 1; i < rows.length; i++) {
    const lagnamn  = String(rows[i][0] || '').trim();
    if (!lagnamn) continue;
    result.push({
      rad:      i + 1,   // 1-based sheet row
      lagnamn:  lagnamn,
      losenord: String(rows[i][1] || '').trim(),
      grupp:    String(rows[i][2] || '').trim(),
      signerad: rows[i][3] === true || String(rows[i][3] || '').toLowerCase() === 'true',
    });
  }
  return result;
}

function handleSparaLag(d) {
  if (!authAdmin(d)) return json({ ok: false, fel: 'unauthorized' });
  const flik = getOrCreate(ss(), F_LAG, ['Lagnamn', 'Losenord', 'Grupp', 'Signerad'], 0, 0);
  const lagnamn  = String(d.lagnamn  || '').trim();
  const losenord = String(d.losenord || '').trim();
  const grupp    = String(d.grupp    || '').trim();
  if (!lagnamn || !losenord || !grupp) return json({ ok: false, fel: 'Fält saknas' });

  if (d.rad) {
    // Uppdatera befintlig rad
    const rad = Number(d.rad);
    flik.getRange(rad, 1, 1, 3).setValues([[lagnamn, losenord, grupp]]);
  } else {
    // Lägg till ny rad
    flik.appendRow([lagnamn, losenord, grupp, false]);
  }
  return json({ ok: true });
}

function handleRaderaLag(d) {
  if (!authAdmin(d)) return json({ ok: false, fel: 'unauthorized' });
  const flik = ss().getSheetByName(F_LAG);
  if (!flik) return json({ ok: false, fel: 'Lag-sheet saknas' });
  const rad = Number(d.rad);
  if (!rad || rad < 2) return json({ ok: false, fel: 'Ogiltig rad' });
  flik.deleteRow(rad);
  return json({ ok: true });
}

function handleSattSignerad(d) {
  if (!authAdmin(d)) return json({ ok: false, fel: 'unauthorized' });
  const flik = ss().getSheetByName(F_LAG);
  if (!flik) return json({ ok: false, fel: 'Lag-sheet saknas' });
  const rad = Number(d.rad);
  if (!rad || rad < 2) return json({ ok: false, fel: 'Ogiltig rad' });
  const val = d.signerad === true || d.signerad === 'true';
  flik.getRange(rad, 4).setValue(val);
  return json({ ok: true });
}

// Lag-sheet kolumnindex
const CL = { lagnamn: 0, losenord: 1, grupp: 2, signerad: 3 };

function handleLagLogin(params) {
  const pw = String(params.pw || '').trim();
  if (!pw) return { ok: false, fel: 'Ingen kod angiven' };
  const spreadsheet = ss();

  // Lag-flik: Lagnamn | Losenord | Grupp | Signerad
  const lagFlik = getOrCreate(spreadsheet, F_LAG,
    ['Lagnamn', 'Losenord', 'Grupp', 'Signerad'], 0, 0);
  const lagRows = lagFlik.getDataRange().getValues();

  for (let i = 1; i < lagRows.length; i++) {
    if (String(lagRows[i][CL.losenord]).trim() !== pw) continue;

    const lagnamn  = String(lagRows[i][CL.lagnamn]).trim();
    const lagGrupp = String(lagRows[i][CL.grupp] || '').trim();
    const signerad = lagRows[i][CL.signerad] === true ||
                     String(lagRows[i][CL.signerad] || '').toLowerCase() === 'true';

    // Hämta spelare från Spelare-sheetet där Grupp matchar
    const spelare = [];
    const spelarFlik = spreadsheet.getSheetByName(F_SP);
    if (spelarFlik && lagGrupp) {
      spelarFlik.getDataRange().getValues().slice(1).forEach(r => {
        if (String(r[CS.grupp] || '').trim() !== lagGrupp) return;
        const namn = String(r[CS.namn] || '').trim();
        if (!namn || namn === 'Namn') return;
        const erhallna = Number(r[CS.erhallna]) || 0;
        spelare.push({ namn, erhallna, slag: Array(18).fill(0), poang: Array(18).fill(0) });
      });
    }

    // Hämta befintliga scores från Scorecard-sheetet (om laget spelat tidigare/öppnar ny browser)
    const scoreFlik = spreadsheet.getSheetByName(F_SCORE);
    if (scoreFlik) {
      // Scorecard-kolumner: Tid(0) Lag(1) Spelare(2) Erhallna(3) Slag1-18(4-21) Poang1-18(22-39) Totalpoang(40)
      scoreFlik.getDataRange().getValues().slice(1).forEach(r => {
        if (String(r[1]).trim().toLowerCase() !== lagnamn.toLowerCase()) return;
        const namnKey = String(r[2]).trim().toLowerCase();
        const sp = spelare.find(s => s.namn.trim().toLowerCase() === namnKey);
        if (!sp) return;
        const slag  = [];
        const poang = [];
        for (let h = 0; h < 18; h++) slag.push(Number(r[4 + h]) || 0);
        for (let h = 0; h < 18; h++) poang.push(Number(r[22 + h]) || 0);
        sp.slag   = slag;
        sp.poang  = poang;
        // Uppdatera även erhallna från Scorecard om det är sparat där
        if (Number(r[3])) sp.erhallna = Number(r[3]);
      });
    }

    return { ok: true, lagnamn, grupp: lagGrupp, spelare, signerad };
  }
  return { ok: false, fel: 'Fel lagkod' };
}

function handleSigneraScore(d) {
  const pw = String(d.pw || '').trim();
  const spreadsheet = ss();
  const lagFlik = spreadsheet.getSheetByName(F_LAG);
  if (!lagFlik) return json({ ok: false, fel: 'Lag-sheet saknas' });

  const lagRows = lagFlik.getDataRange().getValues();
  let lagnamn = null;
  let lagRowIdx = -1;
  for (let i = 1; i < lagRows.length; i++) {
    if (String(lagRows[i][CL.losenord]).trim() === pw) {
      lagnamn   = String(lagRows[i][CL.lagnamn]).trim();
      lagRowIdx = i;
      break;
    }
  }
  if (!lagnamn) return json({ ok: false, fel: 'Obehörig' });

  // Block if already signed
  const alreadySigned = lagRows[lagRowIdx][CL.signerad] === true ||
    String(lagRows[lagRowIdx][CL.signerad] || '').toLowerCase() === 'true';
  if (alreadySigned) return json({ ok: false, fel: 'Redan signerad' });

  // Write to Scorecard (full hole-by-hole data)
  const halHeaders = [];
  for (let h = 1; h <= 18; h++) halHeaders.push('Slag' + h);
  for (let h = 1; h <= 18; h++) halHeaders.push('Poang' + h);
  const scoreFlik = getOrCreate(spreadsheet, F_SCORE,
    ['Tid','Lag','Spelare','Erhallna', ...halHeaders, 'Totalpoang'], 0, 0);

  // Remove existing rows for team, then append fresh
  const existing = scoreFlik.getDataRange().getValues();
  for (let i = existing.length - 1; i >= 1; i--) {
    if (String(existing[i][1]).trim() === lagnamn) scoreFlik.deleteRow(i + 1);
  }
  const tid = new Date().toISOString();
  (d.spelare || []).forEach(sp => {
    scoreFlik.appendRow([
      tid, lagnamn, sp.namn, sp.erhallna,
      ...sp.slag,
      ...sp.poang,
      sp.totalPoang
    ]);
  });

  // Write summary data to Spelare sheet (match by name, case-insensitive)
  const spelarFlik = spreadsheet.getSheetByName(F_SP);
  if (spelarFlik) {
    const spRows = spelarFlik.getDataRange().getValues();
    (d.spelare || []).forEach(sp => {
      const namnKey   = String(sp.namn || '').trim().toLowerCase();
      const totalSlag = (sp.slag || []).reduce((s, v) => s + (Number(v) || 0), 0);
      const netto     = totalSlag > 0 ? totalSlag - (sp.erhallna || 0) : 0;

      for (let r = 1; r < spRows.length; r++) {
        if (String(spRows[r][CS.namn] || '').trim().toLowerCase() === namnKey) {
          spelarFlik.getRange(r + 1, CS.erhallna   + 1).setValue(sp.erhallna || 0);
          spelarFlik.getRange(r + 1, CS.slagBrutto + 1).setValue(totalSlag);
          spelarFlik.getRange(r + 1, CS.slagNetto  + 1).setValue(netto);
          spelarFlik.getRange(r + 1, CS.poang      + 1).setValue(sp.totalPoang || 0);
          break;
        }
      }
    });
  }

  // Mark as signed in Lag sheet (col CL.signerad + 1 = col 4, 1-indexed)
  lagFlik.getRange(lagRowIdx + 1, CL.signerad + 1).setValue(true);

  return json({ ok: true });
}

function handleSparaScore(d) {
  const pw = String(d.pw || '').trim();
  Logger.log('handleSparaScore: pw=%s, action=%s', pw, d.action);

  const spreadsheet = ss();
  const lagFlik = spreadsheet.getSheetByName(F_LAG);
  if (!lagFlik) { Logger.log('Lag-sheet saknas'); return json({ ok: false, fel: 'Lag-sheet saknas' }); }

  const lagRows = lagFlik.getDataRange().getValues();
  Logger.log('Lag-sheet rader: %s', lagRows.length);

  let lagnamn = null;
  let lagRowIdx = -1;
  for (let i = 1; i < lagRows.length; i++) {
    Logger.log('Rad %s: losenord="%s"', i, String(lagRows[i][CL.losenord]).trim());
    if (String(lagRows[i][CL.losenord]).trim() === pw) {
      lagnamn   = String(lagRows[i][CL.lagnamn]).trim();
      lagRowIdx = i;
      break;
    }
  }
  if (!lagnamn) { Logger.log('Obehörig: inget lag hittades för pw=%s', pw); return json({ ok: false, fel: 'Obehörig' }); }
  Logger.log('Lag hittad: lagnamn=%s, rad=%s', lagnamn, lagRowIdx);

  // Block auto-save for already signed teams
  if (lagRowIdx >= 0) {
    const sigVal = lagRows[lagRowIdx][CL.signerad];
    const signed = sigVal === true || String(sigVal || '').toLowerCase() === 'true';
    Logger.log('Signerad-värde: %s → signed=%s', sigVal, signed);
    if (signed) return json({ ok: false, fel: 'Redan signerad' });
  }

  // Bygg header för Scorecard-flik
  const halHeaders = [];
  for (let h = 1; h <= 18; h++) halHeaders.push('Slag' + h);
  for (let h = 1; h <= 18; h++) halHeaders.push('Poang' + h);
  const scoreFlik = getOrCreate(spreadsheet, F_SCORE,
    ['Tid','Lag','Spelare','Erhallna', ...halHeaders, 'Totalpoang'], 0, 0);
  Logger.log('Scorecard-flik hämtad/skapad: %s', scoreFlik.getName());

  // Ta bort befintliga rader för laget (tillåt omregistrering)
  const existing = scoreFlik.getDataRange().getValues();
  for (let i = existing.length - 1; i >= 1; i--) {
    if (String(existing[i][1]).trim() === lagnamn) scoreFlik.deleteRow(i + 1);
  }

  // Lägg till en rad per spelare
  const tid = new Date().toISOString();
  (d.spelare || []).forEach(sp => {
    scoreFlik.appendRow([
      tid, lagnamn, sp.namn, sp.erhallna,
      ...sp.slag,   // 18 värden
      ...sp.poang,  // 18 värden
      sp.totalPoang
    ]);
  });

  // Skriv tillbaka Erhållna Slag till Spelare-sheetet (uppdateras löpande vid auto-save)
  const spelarFlik = ss().getSheetByName(F_SP);
  if (spelarFlik) {
    const spRows = spelarFlik.getDataRange().getValues();
    (d.spelare || []).forEach(sp => {
      const namnKey = String(sp.namn || '').trim().toLowerCase();
      for (let r = 1; r < spRows.length; r++) {
        if (String(spRows[r][CS.namn] || '').trim().toLowerCase() === namnKey) {
          spelarFlik.getRange(r + 1, CS.erhallna + 1).setValue(sp.erhallna || 0);
          break;
        }
      }
    });
  }

  return json({ ok: true });
}

// ── TÄVLING: närmast hål + längst drive (lagras i Sheets-fliken "Tävling") ────

function tavlingSheet() {
  const spreadsheet = ss();
  let flik = spreadsheet.getSheetByName(F_TAVLING);
  if (!flik) {
    flik = spreadsheet.insertSheet(F_TAVLING);
    flik.appendRow(['Typ', 'Hål', 'Vinnare', 'Extra']);
    flik.getRange(1, 1, 1, 4).setFontWeight('bold');
  }
  return flik;
}

function handleSetTavling(d) {
  const props = PropertiesService.getScriptProperties();
  const ADMIN_PW = props.getProperty('ADMIN_PW');
  if (!ADMIN_PW || d.pw !== ADMIN_PW) return json({ ok: false, fel: 'unauthorized' });
  if (!d.typ || !d.hal) return json({ ok: false, fel: 'missing typ/hal' });

  const flik  = tavlingSheet();
  const hal   = Number(d.hal);
  const extra = d.typ === 'ntp' ? (d.avstand || '') : (d.langd || '');

  // Sök befintlig rad för samma typ+hål
  const data = flik.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === d.typ && Number(data[i][1]) === hal) {
      flik.getRange(i + 1, 3, 1, 2).setValues([[d.vinnare || '', extra]]);
      return json({ ok: true });
    }
  }
  // Rad saknas — lägg till ny
  flik.appendRow([d.typ, hal, d.vinnare || '', extra]);
  return json({ ok: true });
}

function hamtaTavling() {
  const flik = ss().getSheetByName(F_TAVLING);
  const result = { ntp: {}, ld: {} };
  if (!flik) return result;

  const data = flik.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    const typ     = String(data[i][0]).trim();
    const hal     = Number(data[i][1]);
    const vinnare = String(data[i][2] || '').trim();
    const extra   = String(data[i][3] || '').trim();
    if (!typ || !hal) continue;
    if (typ === 'ntp') result.ntp[hal] = { vinnare, avstand: extra };
    if (typ === 'ld')  result.ld[hal]  = { vinnare, langd:   extra };
  }
  return result;
}

// Hämtar alla resultat: individuellt (netto slag), lag (middle-2 stableford), tävling
// Scorecard-kolumner: Tid(0) Lag(1) Spelare(2) Erhallna(3) Slag1-18(4-21) Poang1-18(22-39) Totalpoang(40)
function hamtaResultat() {
  const flik = ss().getSheetByName(F_SCORE);
  const tavling = hamtaTavling();
  const tomt = { individuellt: [], lag: [], tavling };
  if (!flik) return tomt;
  const rows = flik.getDataRange().getValues();
  if (rows.length <= 1) return tomt;

  const individuellt = [];
  const lagMap = {};  // lagnamn → { lagnamn, poangPerHal:[[]], spelare:[] }

  for (let i = 1; i < rows.length; i++) {
    const lagnamn = String(rows[i][1]).trim();
    if (!lagnamn) continue;
    const namn     = String(rows[i][2]).trim();
    const erhallna = Number(rows[i][3]) || 0;

    let slagBrutto = 0;
    const poangPerHal = [];
    for (let h = 0; h < 18; h++) {
      slagBrutto += Number(rows[i][4 + h]) || 0;
      poangPerHal.push(Number(rows[i][22 + h]) || 0);
    }
    const totalPoang = Number(rows[i][40]) || 0;
    const slagNetto  = slagBrutto > 0 ? slagBrutto - erhallna : null;

    // Individuellt
    if (slagBrutto > 0) {
      individuellt.push({ namn, lagnamn, slagBrutto, erhallna, slagNetto, totalPoang });
    }

    // Lag — samla poäng per hål för middle-2-beräkning
    if (!lagMap[lagnamn]) lagMap[lagnamn] = { lagnamn, poangPerHal: Array.from({length:18}, ()=>[]), spelare: [] };
    lagMap[lagnamn].spelare.push({ namn, totalPoang });
    for (let h = 0; h < 18; h++) lagMap[lagnamn].poangPerHal[h].push(poangPerHal[h]);
  }

  // Individuellt: sortera på slagNetto (asc), sedan totalPoang (desc) som tiebreak
  individuellt.sort((a, b) => {
    if (a.slagNetto === null && b.slagNetto === null) return 0;
    if (a.slagNetto === null) return 1;
    if (b.slagNetto === null) return -1;
    if (a.slagNetto !== b.slagNetto) return a.slagNetto - b.slagNetto;
    return b.totalPoang - a.totalPoang;
  });

  // Lag: middle-2 stableford per hål — ta bort bäst + sämst, summera resten
  const lag = Object.values(lagMap).map(l => {
    let lagPoang = 0;
    for (let h = 0; h < 18; h++) {
      const sorted = l.poangPerHal[h].slice().sort((a, b) => a - b);
      const middle = sorted.length >= 3 ? sorted.slice(1, sorted.length - 1) : sorted;
      lagPoang += middle.reduce((s, v) => s + v, 0);
    }
    return { lagnamn: l.lagnamn, totalPoang: lagPoang, spelare: l.spelare };
  }).sort((a, b) => b.totalPoang - a.totalPoang);

  return { individuellt, lag, tavling };
}
