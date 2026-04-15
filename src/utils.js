import DOMPurify from 'dompurify';

export function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

export function sanitizeHtml(dirty) {
  return DOMPurify.sanitize(dirty);
}

export function formatTel(raw) {
  if (!raw) return '';
  let digits = raw.replace(/\D/g, '');
  if (digits.startsWith('46') && digits.length >= 11) digits = '0' + digits.slice(2);
  if (!digits.startsWith('0') || digits.length < 9 || digits.length > 10) return raw;
  return digits.slice(0, 3) + '-' + digits.slice(3);
}

export function clearE(id) {
  document.getElementById(id).classList.remove('show');
}

export function showErr(id, msg) {
  const el = document.getElementById(id);
  el.querySelector('.err-text').textContent = msg;
  el.classList.add('show');
  el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
