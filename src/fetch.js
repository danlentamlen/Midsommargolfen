// Fetch with timeout via AbortController + CSRF header on POST
export function fetchWithTimeout(url, options = {}, timeoutMs = 10000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const headers = { ...options.headers };
  if (options.method && options.method.toUpperCase() !== 'GET') {
    headers['X-Requested-With'] = 'XMLHttpRequest';
  }
  return fetch(url, { ...options, headers, signal: controller.signal })
    .finally(() => clearTimeout(timer));
}
