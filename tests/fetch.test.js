import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchWithTimeout } from '../src/fetch.js';

describe('fetchWithTimeout', () => {
  let origFetch;

  beforeEach(() => {
    origFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = origFetch;
    vi.restoreAllMocks();
  });

  it('resolves when fetch completes before timeout', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response('ok'));
    const res = await fetchWithTimeout('https://example.com', {}, 5000);
    expect(await res.text()).toBe('ok');
  });

  it('passes signal to fetch', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response('ok'));
    await fetchWithTimeout('https://example.com', { method: 'POST' }, 5000);
    const callArgs = globalThis.fetch.mock.calls[0];
    expect(callArgs[1]).toHaveProperty('signal');
    expect(callArgs[1].method).toBe('POST');
  });

  it('aborts when timeout expires', async () => {
    vi.useFakeTimers();
    globalThis.fetch = vi.fn().mockImplementation((_url, opts) => {
      return new Promise((_resolve, reject) => {
        opts.signal.addEventListener('abort', () => {
          reject(new DOMException('The operation was aborted', 'AbortError'));
        });
      });
    });

    const promise = fetchWithTimeout('https://example.com', {}, 100);
    vi.advanceTimersByTime(100);
    await expect(promise).rejects.toThrow('aborted');
    vi.useRealTimers();
  });

  it('uses default 10s timeout when not specified', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response('ok'));
    await fetchWithTimeout('https://example.com');
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it('rejects with network error when fetch fails', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(fetchWithTimeout('https://example.com', {}, 5000))
      .rejects.toThrow('Failed to fetch');
  });

  it('clears timeout after successful fetch', async () => {
    const clearSpy = vi.spyOn(globalThis, 'clearTimeout');
    globalThis.fetch = vi.fn().mockResolvedValue(new Response('ok'));
    await fetchWithTimeout('https://example.com', {}, 5000);
    expect(clearSpy).toHaveBeenCalled();
    clearSpy.mockRestore();
  });

  it('includes X-Requested-With CSRF header', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response('ok'));
    await fetchWithTimeout('https://example.com', {}, 5000);
    const callArgs = globalThis.fetch.mock.calls[0];
    expect(callArgs[1].headers['X-Requested-With']).toBe('XMLHttpRequest');
  });

  it('preserves caller-supplied headers alongside CSRF header', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response('ok'));
    await fetchWithTimeout('https://example.com', { headers: { 'Content-Type': 'application/json' } }, 5000);
    const callArgs = globalThis.fetch.mock.calls[0];
    expect(callArgs[1].headers['X-Requested-With']).toBe('XMLHttpRequest');
    expect(callArgs[1].headers['Content-Type']).toBe('application/json');
  });
});
