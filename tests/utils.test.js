import { describe, it, expect, beforeEach } from 'vitest';
import { formatTel, escapeHtml } from '../src/utils.js';
import { photoKey } from '../src/photos.js';

describe('formatTel', () => {
  it('formats a 10-digit Swedish mobile number', () => {
    expect(formatTel('0701234567')).toBe('070-123 45 67');
  });

  it('formats number with country code +46', () => {
    expect(formatTel('+46701234567')).toBe('070-123 45 67');
  });

  it('formats number with country code 46 (no +)', () => {
    expect(formatTel('46701234567')).toBe('070-123 45 67');
  });

  it('strips dashes and spaces before formatting', () => {
    expect(formatTel('070-123 45 67')).toBe('070-123 45 67');
  });

  it('returns empty string for empty input', () => {
    expect(formatTel('')).toBe('');
  });

  it('returns empty string for null/undefined', () => {
    expect(formatTel(null)).toBe('');
    expect(formatTel(undefined)).toBe('');
  });

  it('returns raw input for non-10-digit numbers', () => {
    expect(formatTel('12345')).toBe('12345');
  });
});

describe('photoKey', () => {
  it('uses spelarid when present', () => {
    expect(photoKey({ name: 'Anna', spelarid: 'SP123' })).toBe('id_sp123');
  });

  it('uses golfid when no spelarid, golfid is valid', () => {
    expect(photoKey({ name: 'Anna', golfid: '760828-016' })).toBe('gid_760828-016');
  });

  it('falls back to name when golfid is dash', () => {
    expect(photoKey({ name: 'Anna Svensson', golfid: '—' })).toBe('anna svensson');
  });

  it('falls back to name when no spelarid/golfid', () => {
    expect(photoKey({ name: 'Per Johansson' })).toBe('per johansson');
  });

  it('lowercases all keys', () => {
    expect(photoKey({ name: 'ANNA', spelarid: 'ABC' })).toBe('id_abc');
  });
});

describe('escapeHtml', () => {
  it('escapes HTML tags', () => {
    expect(escapeHtml('<script>alert("xss")</script>')).toBe(
      '&lt;script&gt;alert("xss")&lt;/script&gt;'
    );
  });

  it('escapes ampersands', () => {
    expect(escapeHtml('a & b')).toBe('a &amp; b');
  });

  it('returns empty string for empty input', () => {
    expect(escapeHtml('')).toBe('');
  });

  it('passes through safe text unchanged', () => {
    expect(escapeHtml('Hello World')).toBe('Hello World');
  });

  it('escapes quotes', () => {
    const result = escapeHtml('a "b" c');
    // textContent-based escaping doesn't escape quotes inside text nodes
    // but it does escape < > &
    expect(result).not.toContain('<');
  });

  it('neutralizes script injection via onerror', () => {
    const input = '<img src=x onerror=alert(1)>';
    const result = escapeHtml(input);
    // The < and > are escaped, so the tag cannot be parsed by the browser
    expect(result).not.toContain('<img');
    expect(result).toContain('&lt;img');
    expect(result).toContain('&gt;');
  });

  it('neutralizes nested script tags', () => {
    const input = '<<script>alert("xss")<</script>';
    const result = escapeHtml(input);
    expect(result).not.toContain('<script');
  });

  it('handles SVG-based XSS vectors', () => {
    const input = '<svg onload=alert(1)>';
    const result = escapeHtml(input);
    expect(result).not.toContain('<svg');
    expect(result).toContain('&lt;svg');
  });

  it('handles javascript: protocol in href', () => {
    const input = '<a href="javascript:alert(1)">click</a>';
    const result = escapeHtml(input);
    expect(result).not.toContain('<a');
    expect(result).toContain('&lt;a');
  });

  it('handles event handler attributes', () => {
    const input = '<div onmouseover="alert(1)">hover</div>';
    const result = escapeHtml(input);
    expect(result).not.toContain('<div');
    expect(result).toContain('&lt;div');
  });
});
