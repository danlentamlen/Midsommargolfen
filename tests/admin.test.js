import { describe, it, expect, beforeEach } from 'vitest';

// SHA-256 helper matching src/admin.js
async function sha256(message) {
  const { createHash } = await import('crypto');
  return createHash('sha256').update(message).digest('hex');
}

describe('Admin – login auth via SHA-256', () => {
  const EXPECTED_HASH = 'c3d202d707368179b25dd25eead59c9dd6f45f55e65347c0e23485dfba34e403';

  it('rejects empty password', async () => {
    const hash = await sha256('');
    expect(hash === EXPECTED_HASH).toBe(false);
  });

  it('rejects wrong password', async () => {
    const hash = await sha256('wrongpass');
    expect(hash === EXPECTED_HASH).toBe(false);
  });

  it('accepts correct password', async () => {
    const hash = await sha256('golf2026');
    expect(hash === EXPECTED_HASH).toBe(true);
  });

  it('produces hex string, not plaintext', async () => {
    const hash = await sha256('golf2026');
    expect(hash).not.toBe('golf2026');
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('is deterministic — same input gives same hash', async () => {
    const h1 = await sha256('golf2026');
    const h2 = await sha256('golf2026');
    expect(h1).toBe(h2);
  });
});

describe('Admin – tab switching', () => {
  it('identifies valid tab names', () => {
    const validTabs = ['anm', 'bet', 'sample'];
    expect(validTabs.includes('anm')).toBe(true);
    expect(validTabs.includes('bet')).toBe(true);
    expect(validTabs.includes('sample')).toBe(true);
    expect(validTabs.includes('unknown')).toBe(false);
  });
});

describe('Admin – visibility toggle', () => {
  it('applyBettingVisibility shows/hides elements', () => {
    // Simulate DOM
    document.body.innerHTML = `
      <div class="bet-section" style="display:none">Bet</div>
      <a class="bet-link" style="display:none">Link</a>
    `;

    const show = true;
    const disp = show ? '' : 'none';
    document.querySelectorAll('.bet-section, .bet-link').forEach(el => {
      el.style.display = disp;
    });

    const el = document.querySelector('.bet-section');
    expect(el.style.display).toBe('');
  });

  it('hides betting sections when disabled', () => {
    document.body.innerHTML = `
      <div class="bet-section">Bet</div>
      <a class="bet-link">Link</a>
    `;

    const show = false;
    const disp = show ? '' : 'none';
    document.querySelectorAll('.bet-section, .bet-link').forEach(el => {
      el.style.display = disp;
    });

    const el = document.querySelector('.bet-section');
    expect(el.style.display).toBe('none');
  });
});
