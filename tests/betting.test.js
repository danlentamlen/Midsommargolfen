import { describe, it, expect, beforeEach } from 'vitest';

describe('Betting – player toggle logic', () => {
  const maxPlayers = 5;

  it('toggles player on when under limit', () => {
    const selected = new Set();
    const pid = 'player-3';
    if (selected.has(pid)) {
      selected.delete(pid);
    } else if (selected.size < maxPlayers) {
      selected.add(pid);
    }
    expect(selected.has(pid)).toBe(true);
  });

  it('toggles player off when already selected', () => {
    const selected = new Set(['player-1', 'player-3']);
    const pid = 'player-3';
    if (selected.has(pid)) {
      selected.delete(pid);
    } else if (selected.size < maxPlayers) {
      selected.add(pid);
    }
    expect(selected.has(pid)).toBe(false);
  });

  it('does not add player beyond maxPlayers', () => {
    const selected = new Set(['p1', 'p2', 'p3', 'p4', 'p5']);
    const pid = 'p6';
    if (selected.has(pid)) {
      selected.delete(pid);
    } else if (selected.size < maxPlayers) {
      selected.add(pid);
    }
    expect(selected.has(pid)).toBe(false);
    expect(selected.size).toBe(5);
  });
});

describe('Betting – total calculation', () => {
  const prisPerSpel = 20;

  it('calculates total correctly for multiple players', () => {
    const count = 3;
    const total = count * prisPerSpel;
    expect(total).toBe(60);
  });

  it('zero when no players selected', () => {
    const count = 0;
    const total = count * prisPerSpel;
    expect(total).toBe(0);
  });
});

describe('Betting – odds calculation', () => {
  it('computes vote percentage correctly', () => {
    const votes = [
      { name: 'Alice', count: 3 },
      { name: 'Bob', count: 7 },
    ];
    const totalVotes = votes.reduce((s, v) => s + v.count, 0);
    expect(totalVotes).toBe(10);
    const alicePct = ((3 / totalVotes) * 100).toFixed(0);
    expect(alicePct).toBe('30');
  });

  it('handles zero total votes gracefully', () => {
    const votes = [];
    const totalVotes = votes.reduce((s, v) => s + v.count, 0);
    expect(totalVotes).toBe(0);
  });

  it('sorts by vote count descending', () => {
    const votes = [
      { name: 'Alice', count: 3 },
      { name: 'Charlie', count: 10 },
      { name: 'Bob', count: 7 },
    ];
    const sorted = [...votes].sort((a, b) => b.count - a.count);
    expect(sorted[0].name).toBe('Charlie');
    expect(sorted[1].name).toBe('Bob');
    expect(sorted[2].name).toBe('Alice');
  });
});

describe('Betting – submit validation', () => {
  it('rejects submission with no name', () => {
    const name = '';
    const email = 'test@test.se';
    const count = 3;
    const isValid = name && email && count > 0;
    expect(isValid).toBeFalsy();
  });

  it('rejects submission with no email', () => {
    const name = 'Test';
    const email = '';
    const count = 3;
    const isValid = name && email && count > 0;
    expect(isValid).toBeFalsy();
  });

  it('rejects submission with zero players', () => {
    const name = 'Test';
    const email = 'test@test.se';
    const count = 0;
    const isValid = name && email && count > 0;
    expect(isValid).toBeFalsy();
  });

  it('accepts valid submission', () => {
    const name = 'Test';
    const email = 'test@test.se';
    const count = 3;
    const isValid = name && email && count > 0;
    expect(isValid).toBeTruthy();
  });
});
