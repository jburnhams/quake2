import { describe, expect, it } from 'vitest';
import {
  U_ANGLE1,
  U_ANGLE2,
  U_ANGLE3,
  U_EFFECTS,
  U_EVENT,
  U_FRAME,
  U_MODEL,
  U_MODEL2,
  U_MODEL3,
  U_MODEL4,
  U_MOREBITS,
  U_NUMBER,
  U_ORIGIN1,
  U_ORIGIN2,
  U_ORIGIN3,
  U_REMOVE,
  U_RENDERFX,
  U_SKIN,
  U_SOLID,
  U_SOUND,
} from '../../src/protocol/entityFlags.js';

describe('protocol/entityFlags', () => {
  it('defines correct entity delta flags', () => {
    expect(U_NUMBER).toBe(1 << 0);
    expect(U_MODEL).toBe(1 << 1);
    expect(U_SOUND).toBe(1 << 2);
    expect(U_ORIGIN1).toBe(1 << 3);
    expect(U_ORIGIN2).toBe(1 << 4);
    expect(U_ORIGIN3).toBe(1 << 5);
    expect(U_ANGLE1).toBe(1 << 6);
    expect(U_ANGLE2).toBe(1 << 7);
    expect(U_ANGLE3).toBe(1 << 8);
    expect(U_FRAME).toBe(1 << 9);
    expect(U_SKIN).toBe(1 << 10);
    expect(U_EFFECTS).toBe(1 << 11);
    expect(U_RENDERFX).toBe(1 << 12);
    expect(U_SOLID).toBe(1 << 13);
    expect(U_EVENT).toBe(1 << 14);
    expect(U_MOREBITS).toBe(1 << 15);
  });

  it('defines correct extended bits', () => {
    expect(U_MODEL2).toBe(1 << 0);
    expect(U_MODEL3).toBe(1 << 1);
    expect(U_MODEL4).toBe(1 << 2);
  });

  it('defines correct remove flag', () => {
    expect(U_REMOVE).toBe(0x8000);
  });
});
