import { describe, expect, it } from 'vitest';
import { MersenneTwister19937, RandomGenerator } from '../src/index.js';

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
  it('produces deterministic fractions in [0, 1), a sample rounded to a float over 2^32', () => {
    const rng = new RandomGenerator();
    expect(rng.frandom()).toBe(Math.fround(3499211612) / TWO_POW_32);
    expect(rng.frandom()).toBe(Math.fround(581869302) / TWO_POW_32);
  });

  it('maps fractions into custom ranges in float arithmetic', () => {
    const rng = stubbedRandomGenerator([0, 0xffffffff, 0x40000000]);
    expect(rng.frandomRange(-10, 10)).toBe(-10);
    // 0xffffffff rounds to 2^32 as a float, which generate_canonical turns into the float below 1
    expect(rng.frandomRange(-10, 10)).toBe(Math.fround(Math.fround((1 - 2 ** -24) * 20) - 10));
    expect(rng.frandomMax(5)).toBe(5 * 0.25);
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

  it('takes integers from the high half of sample * span (Lemire, as libstdc++)', () => {
    const rng = stubbedRandomGenerator([0x80000001, 0x40000000, 0xc0000000]);
    expect(rng.irandomRange(2, 12)).toBe(7); // 2 + (2^31 * 10 >> 32)
    expect(rng.irandom(8)).toBe(2); // 2^30 * 8 >> 32
    expect(rng.randomTime(1000)).toBe(750); // [0, 1000] inclusive: 0.75 * 1001 >> 0
    expect(rng.randomTimeRange(500, 501)).toBe(501); // inclusive: 0.75 * 2 >> 0
    expect(rng.randomTimeRange(500, 500)).toBe(500); // collapsed span returns min
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

  it('draws again while the low half of the product is under -span % span', () => {
    // span 10: threshold (2^32 - 10) % 10 = 6, so a sample whose product's low half is under 6 is redrawn
    const rng = stubbedRandomGenerator([0, 0x80000001]);
    expect(rng.irandomRange(100, 110)).toBe(105);
  });
});
