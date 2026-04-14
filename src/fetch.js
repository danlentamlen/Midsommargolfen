// Fetch with timeout via AbortController + CSRF header
export function fetchWithTimeout(url, options = {}, timeoutMs = 10000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const headers = { 'X-Requested-With': 'XMLHttpRequest', ...options.headers };
  return fetch(url, { ...options, headers, signal: controller.signal })
    .finally(() => clearTimeout(timer));
}
