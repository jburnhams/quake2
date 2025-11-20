import { describe, expect, it } from 'vitest';
import { MersenneTwister19937, RandomGenerator } from '../src/math/random.js';

const TWO_POW_32 = 0x100000000;

function collect(mt: MersenneTwister19937, count: number): number[] {
  const values: number[] = [];
  for (let i = 0; i < count; i++) {
    values.push(mt.nextUint32());
  }
  return values;
}

describe('MersenneTwister19937', () => {
  it('matches the canonical MT19937 sequence for the default seed', () => {
    const mt = new MersenneTwister19937();
    expect(collect(mt, 10)).toEqual([
      3499211612,
      581869302,
      3890346734,
      3586334585,
      545404204,
      4161255391,
      3922919429,
      949333985,
      2715962298,
      1323567403,
    ]);
  });

  it('matches the canonical MT19937 sequence for an arbitrary seed', () => {
    const mt = new MersenneTwister19937(1234);
    expect(collect(mt, 10)).toEqual([
      822569775,
      2137449171,
      2671936806,
      3512589365,
      1880026316,
      2629000564,
      3373089432,
      3312965625,
      3349970575,
      3696548529,
    ]);
  });
});

function stubbedRandomGenerator(samples: readonly number[]): RandomGenerator {
  const rng = new RandomGenerator({ seed: 1 });
  let index = 0;
  const mt = (rng as unknown as { mt: { nextUint32: () => number } }).mt;
  mt.nextUint32 = () => {
    const value = samples[Math.min(index, samples.length - 1)] >>> 0;
    index += 1;
    return value;
  };
  return rng;
}

describe('RandomGenerator helpers', () => {
  it('produces deterministic fractions in [0, 1)', () => {
    const rng = new RandomGenerator();
    expect(rng.frandom()).toBeCloseTo(3499211612 / TWO_POW_32, 10);
    expect(rng.frandom()).toBeCloseTo(581869302 / TWO_POW_32, 10);
  });

  it('maps fractions into custom ranges', () => {
    const rng = stubbedRandomGenerator([0, 0xffffffff, 0x40000000]);
    expect(rng.frandomRange(-10, 10)).toBe(-10);
    const high = -10 + 20 * (0xffffffff / TWO_POW_32);
    expect(rng.frandomRange(-10, 10)).toBeCloseTo(high, 10);
    expect(rng.frandomMax(5)).toBeCloseTo(5 * (0x40000000 / TWO_POW_32), 10);
  });

  it('respects crandom bounds, including the open variant', () => {
    const rng = stubbedRandomGenerator([0, 0xffffffff]);
    const closed = rng.crandom();
    expect(closed).toBeGreaterThanOrEqual(-1);
    expect(closed).toBeLessThan(1);

    const open = rng.crandomOpen();
    expect(open).toBeGreaterThan(-1);
    expect(open).toBeLessThan(1);
  });

  it('returns deterministic integers across the helper methods', () => {
    const rng = stubbedRandomGenerator([5, 10, 25]);
    expect(rng.irandomRange(2, 12)).toBe(7); // (5 % 10) + 2
    expect(rng.irandom(8)).toBe(2); // 10 % 8
    expect(rng.randomTime(1000)).toBe(25);
    expect(rng.randomTimeRange(500, 501)).toBe(500); // collapsed span returns min
  });

  it('selects indices safely even for empty containers', () => {
    const rng = new RandomGenerator({ seed: 42 });
    expect(rng.randomIndex({ length: 0 })).toBe(0);
    const arr = [1, 2, 3, 4];
    const index = rng.randomIndex(arr);
    expect(index).toBeGreaterThanOrEqual(0);
    expect(index).toBeLessThan(arr.length);
  });

  it('restores state to reproduce the same random sequence', () => {
    const rng1 = new RandomGenerator({ seed: 123 });
    rng1.frandom();
    rng1.frandom();

    const state = rng1.getState();
    const rng2 = new RandomGenerator({ seed: 456 }); // different seed
    rng2.setState(state);

    expect(rng1.frandom()).toBe(rng2.frandom());
    expect(rng1.irandom(100)).toBe(rng2.irandom(100));
  });

  it('debiases integer ranges correctly', () => {
    const span = 10;
    const limit = TWO_POW_32 - (TWO_POW_32 % span);
    // First sample is biased (above the limit), second is not.
    const rng = stubbedRandomGenerator([limit, 5]);
    // The first sample should be discarded by the debiasing loop.
    const result = rng.irandomRange(100, 110);
    expect(result).toBe(105); // 100 + (5 % 10)
  });
});
