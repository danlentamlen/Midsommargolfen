import { CFG } from './config.js';
import { fetchWithTimeout } from './fetch.js';

// --- Photo key ---
export function photoKey(p) {
  if (p.spelarid) return ('id_' + p.spelarid).toLowerCase();
  if (p.golfid && p.golfid !== '\u2014' && p.golfid !== '—') return ('gid_' + p.golfid).toLowerCase();
  return p.name.toLowerCase();
}

// --- Local cache ---
export function getLocalPhotos() {
  try { return JSON.parse(localStorage.getItem('golf_photos') || '{}'); } catch { return {}; }
}

export function saveLocalPhoto(key, url) {
  try {
    const p = getLocalPhotos();
    p[key] = url;
    localStorage.setItem('golf_photos', JSON.stringify(p));
  } catch { /* localStorage full */ }
}

// --- Fetch Drive photos into local cache ---
export async function fetchDrivePhotos(players) {
  if (!CFG.drivePhotoFolderId || !CFG.appsScriptUrl) return;
  try {
    const r = await fetchWithTimeout(
      CFG.appsScriptUrl + '?action=sponsorbilder&folderId=' + encodeURIComponent(CFG.drivePhotoFolderId)
    );
    const files = await r.json();
    if (!Array.isArray(files) || !files.length) return;

    const driveMap = {};
    files.forEach(f => {
      const fileName = (f.namn || '').toLowerCase().replace(/\s+/g, '_');
      const url = f.base64
        ? `data:${f.mimeType || 'image/jpeg'};base64,${f.base64}`
        : f.url || '';
      if (fileName && url) driveMap[fileName] = url;
    });

    const cache = getLocalPhotos();
    let updated = false;
    players.forEach(p => {
      const key = photoKey(p);
      const driveFileName = key.replace(/\s+/g, '_');
      if (driveMap[driveFileName] && !cache[key]) {
        cache[key] = driveMap[driveFileName];
        updated = true;
      }
    });
    if (updated) {
      try { localStorage.setItem('golf_photos', JSON.stringify(cache)); } catch { /* full */ }
    }
  } catch (e) {
    console.warn('fetchDrivePhotos failed:', e);
  }
}

// --- Compress image ---
export function compressImage(file, maxWidth, quality) {
  return new Promise((res, rej) => {
    const img    = new Image();
    const reader = new FileReader();
    reader.onload = ev => {
      img.onload = () => {
        const scale  = Math.min(1, maxWidth / img.width);
        const w      = Math.round(img.width  * scale);
        const h      = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width  = w;
        canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        res(canvas.toDataURL('image/jpeg', quality).split(',')[1]);
      };
      img.onerror = rej;
      img.src = ev.target.result;
    };
    reader.onerror = rej;
    reader.readAsDataURL(file);
  });
}

// --- Chunked Drive upload ---
export async function uploadPhotoToDrive(key, file) {
  if (!CFG.drivePhotoFolderId || !CFG.appsScriptUrl) {
    console.warn('uploadPhotoToDrive: missing folderId or appsScriptUrl');
    return null;
  }

  let b64;
  try {
    b64 = await compressImage(file, 300, 0.50);
  } catch (e) {
    console.error('Image compression failed:', e);
    return null;
  }

  const CHUNK    = 4000;
  const chunks   = [];
  for (let i = 0; i < b64.length; i += CHUNK) chunks.push(b64.slice(i, i + CHUNK));
  const uploadId = key + '_' + Date.now();

  console.log(`Uploading photo "${key}": ${chunks.length} chunks, ${b64.length} chars total`);

  for (let i = 0; i < chunks.length; i++) {
    const url = CFG.appsScriptUrl
      + '?action=uploadChunk'
      + '&uploadId='  + encodeURIComponent(uploadId)
      + '&chunk='     + encodeURIComponent(chunks[i])
      + '&index='     + i
      + '&total='     + chunks.length
      + '&namn='      + encodeURIComponent(key)
      + '&folderId='  + encodeURIComponent(CFG.drivePhotoFolderId)
      + '&mimeType=image/jpeg';

    let d;
    try {
      const r = await fetchWithTimeout(url);
      d = await r.json();
    } catch (e) {
      console.error(`Chunk ${i}/${chunks.length} fetch failed:`, e);
      return null;
    }

    if (!d.ok) {
      console.error(`Chunk ${i} rejected by Apps Script:`, d.fel || d);
      return null;
    }

    console.log(`Chunk ${i + 1}/${chunks.length} ok`, d.url ? `→ ${d.url}` : '');

    if (i === chunks.length - 1) {
      if (d.url) {
        saveLocalPhoto(key, d.url);
        return d.url;
      } else {
        console.error('Last chunk ok but no url returned:', d);
        return null;
      }
    }
  }
  return null;
}    const driveMap = {};
    files.forEach(f => {
      const fileName = (f.namn || '').toLowerCase().replace(/\s+/g, '_');
      const url = f.base64
        ? `data:${f.mimeType||'image/jpeg'};base64,${f.base64}`
        : f.url || '';
      if (fileName && url) driveMap[fileName] = url;
    });

    // Match players to Drive files and update local cache
    const cache = getLocalPhotos();
    let updated = false;
    players.forEach(p => {
      const key = photoKey(p);
      const driveFileName = key.replace(/\s+/g, '_');
      if (driveMap[driveFileName] && !cache[key]) {
        cache[key] = driveMap[driveFileName];
        updated = true;
      }
    });
    if (updated) {
      try { localStorage.setItem('golf_photos', JSON.stringify(cache)); } catch { /* full */ }
    }
  } catch { /* Drive fetch failed — use local cache */ }
}

// --- Upload photo to Drive (chunked), then cache the Drive URL locally ---
export async function uploadPhotoToDrive(key, file) {
  if (!CFG.drivePhotoFolderId || !CFG.appsScriptUrl) return null;
  try {
    const b64 = await compressImage(file, 300, 0.50);
    const CHUNK = 4000;
    const chunks = [];
    for (let i = 0; i < b64.length; i += CHUNK) {
      chunks.push(b64.slice(i, i + CHUNK));
    }
    const uploadId = key + '_' + Date.now();

    for (let i = 0; i < chunks.length; i++) {
      const url = CFG.appsScriptUrl
        + '?action=uploadChunk'
        + '&uploadId='  + encodeURIComponent(uploadId)
        + '&chunk='     + encodeURIComponent(chunks[i])
        + '&index='     + i
        + '&total='     + chunks.length
        + '&namn='      + encodeURIComponent(key)
        + '&folderId='  + encodeURIComponent(CFG.drivePhotoFolderId)
        + '&mimeType=image/jpeg';
      const r = await fetchWithTimeout(url);
      const d = await r.json();
      if (i === chunks.length - 1 && d.url) {
        // Persist Drive URL in local cache
        saveLocalPhoto(key, d.url);
        return d.url;
      }
    }
    return null;
  } catch { return null; }
}

export function compressImage(file, maxWidth, quality) {
  return new Promise(res => {
    const img = new Image();
    const reader = new FileReader();
    reader.onload = ev => {
      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.width);
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        res(canvas.toDataURL('image/jpeg', quality).split(',')[1]);
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  });
}
