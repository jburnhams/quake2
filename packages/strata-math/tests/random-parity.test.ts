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

describe('RandomGenerator distributions', () => {
  // Printed by std::mt19937(5489) through libstdc++ 13's uniform_real_distribution<float> and
  // uniform_int_distribution, one generator for the whole sequence, as the game draws them.
  it('draws what libstdc++ draws, in the same order', () => {
    const rng = new RandomGenerator({ seed: 5489 });
    const f = (n: number, draw: () => number) => Array.from({ length: n }, draw).map((v) => (Number.isInteger(v) ? v : Number(v.toPrecision(9))));
    expect(f(4, () => rng.frandom())).toEqual([0.81472367, 0.135477006, 0.905791938, 0.835008562]);
    expect(f(4, () => rng.frandomRange(-5.5, 200))).toEqual([20.5957909, 193.602325, 182.19873, 39.9224968]);
    expect(f(4, () => rng.crandom())).toEqual([0.264718533, -0.383665919, -0.804919183, 0.0944411755]);
    expect(f(4, () => rng.crandomOpen())).toEqual([-0.443003476, -0.623236001, 0.0937630534, 0.985762656]);
    expect(f(4, () => rng.irandom(16))).toEqual([15, 15, 15, 15]);
    expect(f(4, () => rng.irandomRange(3, 10))).toEqual([4, 8, 9, 9]);
    expect(f(4, () => rng.irandomRange(0, 2000000001))).toEqual([1914333900, 219723501, 970751297, 1596211714]);
    expect(f(4, () => rng.randomTimeRange(100, 1500))).toEqual([1221, 516, 298, 106]);
  });
});
