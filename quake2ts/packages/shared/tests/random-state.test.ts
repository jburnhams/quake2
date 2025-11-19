import { describe, expect, it } from 'vitest';
import {
  MersenneTwister19937,
  RandomGenerator,
  createRandomGeneratorFromSnapshot,
} from '../src/math/random.js';

function collectUint32(rng: RandomGenerator, count: number): number[] {
  const values: number[] = [];
  for (let i = 0; i < count; i++) {
    values.push(rng.irandomUint32());
  }
  return values;
}

describe('MersenneTwister19937 state round-trips', () => {
  it('restores sequences exactly after serialization', () => {
    const rng = new RandomGenerator({ seed: 1337 });
    const prefix = collectUint32(rng, 12);

    const snapshot = rng.toSnapshot();
    const continuation = collectUint32(rng, 12);

    const restored = createRandomGeneratorFromSnapshot(snapshot);
    const replayed = collectUint32(restored, 12);

    expect(prefix).toHaveLength(12);
    expect(continuation).toEqual(replayed);
  });

  it('handles state captured across multiple twists', () => {
    const rng = new RandomGenerator({ seed: 2024 });

    const firstChunk = collectUint32(rng, 650);
    const midSnapshot = rng.toSnapshot();
    const secondChunk = collectUint32(rng, 50);

    const restored = createRandomGeneratorFromSnapshot(midSnapshot);
    const replayedChunk = collectUint32(restored, 50);

    expect(firstChunk.slice(0, 5)).toEqual([2525503112, 3251949050, 3002649184, 3172895360, 808106523]);
    expect(secondChunk).toEqual(replayedChunk);
  });

  it('fails fast for invalid snapshots', () => {
    const mt = new MersenneTwister19937();
    const snapshot = mt.getState();

    expect(() => mt.restoreState({ ...snapshot, index: -1 })).toThrow();
    expect(() => mt.restoreState({ ...snapshot, state: [] })).toThrow();
  });
});

describe('RandomGenerator JSON interoperability', () => {
  it('round-trips through JSON.stringify/parse', () => {
    const rng = new RandomGenerator({ seed: 9001 });

    collectUint32(rng, 32);
    const snapshot = rng.toSnapshot();
    const json = JSON.stringify(snapshot);
    const restored = createRandomGeneratorFromSnapshot(JSON.parse(json));

    expect(collectUint32(rng, 8)).toEqual(collectUint32(restored, 8));
  });
});
