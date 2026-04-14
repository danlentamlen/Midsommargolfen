import { CFG } from './config.js';
import { fetchWithTimeout } from './fetch.js';

// --- Photo key: deterministic identifier for a player's photo ---
export function photoKey(p) {
  if (p.spelarid) return ('id_' + p.spelarid).toLowerCase();
  if (p.golfid && p.golfid !== '\u2014') return ('gid_' + p.golfid).toLowerCase();
  return p.name.toLowerCase();
}

// --- Local cache (write-through) ---
export function getLocalPhotos() {
  try { return JSON.parse(localStorage.getItem('golf_photos')||'{}'); } catch { return {}; }
}

export function saveLocalPhoto(key, url) {
  try {
    const p = getLocalPhotos();
    p[key] = url;
    localStorage.setItem('golf_photos', JSON.stringify(p));
  } catch { /* localStorage full or unavailable */ }
}

// --- Fetch all Drive photos and merge into local cache ---
// The Drive folder stores files named <photoKey>.jpg.
// We resolve their public URLs and cache them locally.
export async function fetchDrivePhotos(players) {
  if (!CFG.drivePhotoFolderId || !CFG.appsScriptUrl) return;
  try {
    const r = await fetchWithTimeout(
      CFG.appsScriptUrl + '?action=sponsorbilder&folderId=' + encodeURIComponent(CFG.drivePhotoFolderId)
    );
    const files = await r.json();
    if (!Array.isArray(files) || !files.length) return;

    // Build a name→url map from Drive files
    const driveMap = {};
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
