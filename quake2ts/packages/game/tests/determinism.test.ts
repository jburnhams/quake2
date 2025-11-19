import { describe, expect, it } from 'vitest';
import { createGame, hashGameState } from '../src/index.js';

const GRAVITY = { x: 0, y: 0, z: -800 } as const;

const mockEngine = {
  trace(start: typeof GRAVITY, end: typeof GRAVITY) {
    return { start, end, fraction: 1 };
  },
};

function runGameHashes({ frames = 8, gravity = GRAVITY } = {}): number[] {
  const game = createGame(mockEngine, { gravity });
  const hashes: number[] = [];
  const initial = game.init(0);
  if (initial?.state) {
    hashes.push(hashGameState(initial.state));
  }

  for (let frame = 1; frame <= frames; frame += 1) {
    const snapshot = game.frame({ frame, deltaMs: 25, nowMs: frame * 25 });
    hashes.push(hashGameState(snapshot.state));
  }

  return hashes;
}

describe('game state determinism', () => {
  const rereleaseBaseline = [
    514213258,
    775935058,
    3901369870,
    427324724,
    922736138,
    532101252,
    893656737,
    3518326941,
    642580255,
  ];

  it('produces stable hashes across repeated runs', () => {
    const first = runGameHashes();
    const second = runGameHashes();

    expect(first).toEqual(rereleaseBaseline);
    expect(second).toEqual(rereleaseBaseline);
  });

  it('detects divergences when physics inputs change', () => {
    const reducedGravity = runGameHashes({ frames: 3, gravity: { x: 0, y: 0, z: -600 } });
    expect(reducedGravity).toEqual([3516794097, 3896079895, 2980791369, 2898075293]);
    expect(reducedGravity).not.toEqual(rereleaseBaseline.slice(0, reducedGravity.length));
  });
});
