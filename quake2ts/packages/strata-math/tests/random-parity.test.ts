import { describe, expect, it } from 'vitest';
import { MersenneTwister19937, RandomGenerator } from '../src/index.js';

const FIRST_FIVE_MT_VALUES = [
  3499211612,
  581869302,
  3890346734,
  3586334585,
  545404204,
];

describe('MersenneTwister19937 state parity', () => {
  it('matches the std::mt19937 initial output sequence from the rerelease', () => {
    const mt = new MersenneTwister19937();
    const outputs = FIRST_FIVE_MT_VALUES.map(() => mt.nextUint32());
    expect(outputs).toEqual(FIRST_FIVE_MT_VALUES);
  });

  it('round-trips internal state exactly', () => {
    const mt = new MersenneTwister19937(1234);
    mt.nextUint32();
    mt.nextUint32();
    mt.nextUint32();
    const snapshot = mt.getState();

    // Advance further so state definitely changes.
    const futureSamples = [mt.nextUint32(), mt.nextUint32(), mt.nextUint32()];

    const clone = new MersenneTwister19937(9876);
    clone.setState(snapshot);
    expect([clone.nextUint32(), clone.nextUint32(), clone.nextUint32()]).toEqual(futureSamples);
  });
});

describe('RandomGenerator state handling', () => {
  it('preserves deterministic sequences through state export/import', () => {
    const rng = new RandomGenerator({ seed: 42 });
    rng.irandomUint32();
    rng.irandomUint32();
    const state = rng.getState();

    const expectedContinuation = [rng.irandomUint32(), rng.irandomUint32()];

    const restored = new RandomGenerator({ seed: 999 });
    restored.setState(state);

    expect([restored.irandomUint32(), restored.irandomUint32()]).toEqual(expectedContinuation);
    expect(rng.irandomUint32()).toBe(restored.irandomUint32());
  });
});
