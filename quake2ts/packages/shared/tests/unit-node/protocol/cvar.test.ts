import { describe, expect, it } from 'vitest';
import { CvarFlags } from '../../../src/protocol/cvar.js';

describe('protocol/cvar', () => {
  it('defines correct CvarFlags enum values', () => {
    expect(CvarFlags.None).toBe(0);
    expect(CvarFlags.Archive).toBe(1 << 0);
    expect(CvarFlags.UserInfo).toBe(1 << 1);
    expect(CvarFlags.ServerInfo).toBe(1 << 2);
    expect(CvarFlags.Latch).toBe(1 << 3);
    expect(CvarFlags.Cheat).toBe(1 << 4);
  });
});
