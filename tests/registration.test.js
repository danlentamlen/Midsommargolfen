import { describe, it, expect, beforeEach, vi } from 'vitest';

// Minimal CFG for testing
const CFG = {
  prisGolf: 500,
  prisFest: 400,
  prisFull: 900,
  prisBetPerSpel: 20,
  swishGolf: '070-111 22 33',
  swishFest: '070-444 55 66',
  swishLankGolf: '',
  swishLankFest: '',
  maxGolf: 32,
  maxFest: 60,
  appsScriptUrl: '',
};

describe('Registration validation', () => {
  it('requires name and email', () => {
    const name = '';
    const email = '';
    const isValid = name && email;
    expect(isValid).toBeFalsy();
  });

  it('accepts valid name and email', () => {
    const name = 'Anna Svensson';
    const email = 'anna@test.se';
    const isValid = name && email;
    expect(isValid).toBeTruthy();
  });

  it('requires golf-id for golf and full packages', () => {
    const pkg = 'golf';
    const gid = '';
    const needsGid = (pkg === 'full' || pkg === 'golf') && !gid;
    expect(needsGid).toBe(true);
  });

  it('does not require golf-id for party package', () => {
    const pkg = 'party';
    const gid = '';
    const needsGid = (pkg === 'full' || pkg === 'golf') && !gid;
    expect(needsGid).toBe(false);
  });

  it('validates golf-id format YYMMDD-NNN', () => {
    const regex = /^\d{6}-\d{3}$/;
    expect(regex.test('760828-016')).toBe(true);
    expect(regex.test('76082-016')).toBe(false);
    expect(regex.test('760828016')).toBe(false);
    expect(regex.test('abcdef-ghi')).toBe(false);
    expect(regex.test('')).toBe(false);
  });
});

describe('Registration pricing', () => {
  it('returns correct price for full package', () => {
    const pkg = 'full';
    const belopp = pkg === 'full' ? CFG.prisFull : pkg === 'golf' ? CFG.prisGolf : CFG.prisFest;
    expect(belopp).toBe(900);
  });

  it('returns correct price for golf package', () => {
    const pkg = 'golf';
    const belopp = pkg === 'full' ? CFG.prisFull : pkg === 'golf' ? CFG.prisGolf : CFG.prisFest;
    expect(belopp).toBe(500);
  });

  it('returns correct price for party package', () => {
    const pkg = 'party';
    const belopp = pkg === 'full' ? CFG.prisFull : pkg === 'golf' ? CFG.prisGolf : CFG.prisFest;
    expect(belopp).toBe(400);
  });
});

describe('Capacity tracking', () => {
  it('counts golf participants correctly', () => {
    const parts = [
      { pkg: 'full' },
      { pkg: 'golf' },
      { pkg: 'party' },
      { pkg: 'full' },
    ];
    const golfCnt = parts.filter(p => p.pkg === 'full' || p.pkg === 'golf').length;
    const festCnt = parts.filter(p => p.pkg === 'full' || p.pkg === 'party').length;
    expect(golfCnt).toBe(3);
    expect(festCnt).toBe(3);
  });

  it('calculates percentage correctly', () => {
    const golfCnt = 16;
    const gP = Math.min((golfCnt / CFG.maxGolf) * 100, 100);
    expect(gP).toBe(50);
  });

  it('caps percentage at 100', () => {
    const golfCnt = 40;
    const gP = Math.min((golfCnt / CFG.maxGolf) * 100, 100);
    expect(gP).toBe(100);
  });

  it('calculates remaining spots', () => {
    const golfCnt = 30;
    const gL = CFG.maxGolf - golfCnt;
    expect(gL).toBe(2);
  });
});
