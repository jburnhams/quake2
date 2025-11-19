import { describe, expect, it } from 'vitest';
import {
  CONTENTS_AREAPORTAL,
  CONTENTS_AUX,
  CONTENTS_CURRENT_0,
  CONTENTS_CURRENT_180,
  CONTENTS_CURRENT_270,
  CONTENTS_CURRENT_90,
  CONTENTS_CURRENT_DOWN,
  CONTENTS_CURRENT_UP,
  CONTENTS_DEADMONSTER,
  CONTENTS_DETAIL,
  CONTENTS_LADDER,
  CONTENTS_LAVA,
  CONTENTS_MIST,
  CONTENTS_MONSTER,
  CONTENTS_MONSTERCLIP,
  CONTENTS_NO_WATERJUMP,
  CONTENTS_ORIGIN,
  CONTENTS_PLAYER,
  CONTENTS_PLAYERCLIP,
  CONTENTS_PROJECTILE,
  CONTENTS_PROJECTILECLIP,
  CONTENTS_SLIME,
  CONTENTS_SOLID,
  CONTENTS_TRANSLUCENT,
  CONTENTS_WATER,
  CONTENTS_WINDOW,
  LAST_VISIBLE_CONTENTS,
  MASK_BLOCK_SIGHT,
  MASK_CURRENT,
  MASK_DEADSOLID,
  MASK_LADDER_NAV_SOLID,
  MASK_MONSTERSOLID,
  MASK_NAV_SOLID,
  MASK_OPAQUE,
  MASK_PLAYERSOLID,
  MASK_PROJECTILE,
  MASK_SHOT,
  MASK_SOLID,
  MASK_WALK_NAV_SOLID,
  MASK_WATER,
  addContents,
  combineSurfaceFlags,
  hasAllContents,
  hasAnyContents,
  hasSurfaceFlags,
  removeContents,
  SURF_ALPHATEST,
  SURF_FLOWING,
  SURF_LIGHT,
  SURF_N64_SCROLL_FLIP,
  SURF_N64_SCROLL_X,
  SURF_N64_SCROLL_Y,
  SURF_N64_UV,
  SURF_NODRAW,
  SURF_NONE,
  SURF_SLICK,
  SURF_SKY,
  SURF_TRANS33,
  SURF_TRANS66,
  SURF_WARP,
} from '../src/bsp/contents.js';

describe('contents flags mirror rerelease game.h bit positions', () => {
  const expectations: Array<[string, number, number]> = [
    ['CONTENTS_SOLID', CONTENTS_SOLID, 1 << 0],
    ['CONTENTS_WINDOW', CONTENTS_WINDOW, 1 << 1],
    ['CONTENTS_AUX', CONTENTS_AUX, 1 << 2],
    ['CONTENTS_LAVA', CONTENTS_LAVA, 1 << 3],
    ['CONTENTS_SLIME', CONTENTS_SLIME, 1 << 4],
    ['CONTENTS_WATER', CONTENTS_WATER, 1 << 5],
    ['CONTENTS_MIST', CONTENTS_MIST, 1 << 6],
    ['CONTENTS_NO_WATERJUMP', CONTENTS_NO_WATERJUMP, 1 << 13],
    ['CONTENTS_PROJECTILECLIP', CONTENTS_PROJECTILECLIP, 1 << 14],
    ['CONTENTS_AREAPORTAL', CONTENTS_AREAPORTAL, 1 << 15],
    ['CONTENTS_PLAYERCLIP', CONTENTS_PLAYERCLIP, 1 << 16],
    ['CONTENTS_MONSTERCLIP', CONTENTS_MONSTERCLIP, 1 << 17],
    ['CONTENTS_CURRENT_0', CONTENTS_CURRENT_0, 1 << 18],
    ['CONTENTS_CURRENT_90', CONTENTS_CURRENT_90, 1 << 19],
    ['CONTENTS_CURRENT_180', CONTENTS_CURRENT_180, 1 << 20],
    ['CONTENTS_CURRENT_270', CONTENTS_CURRENT_270, 1 << 21],
    ['CONTENTS_CURRENT_UP', CONTENTS_CURRENT_UP, 1 << 22],
    ['CONTENTS_CURRENT_DOWN', CONTENTS_CURRENT_DOWN, 1 << 23],
    ['CONTENTS_ORIGIN', CONTENTS_ORIGIN, 1 << 24],
    ['CONTENTS_MONSTER', CONTENTS_MONSTER, 1 << 25],
    ['CONTENTS_DEADMONSTER', CONTENTS_DEADMONSTER, 1 << 26],
    ['CONTENTS_DETAIL', CONTENTS_DETAIL, 1 << 27],
    ['CONTENTS_TRANSLUCENT', CONTENTS_TRANSLUCENT, 1 << 28],
    ['CONTENTS_LADDER', CONTENTS_LADDER, 1 << 29],
    ['CONTENTS_PLAYER', CONTENTS_PLAYER, 1 << 30],
    ['CONTENTS_PROJECTILE', CONTENTS_PROJECTILE, 1 << 31],
  ];

  it.each(expectations)('%s matches rerelease bit position', (_label, actual, expected) => {
    expect(actual).toBe(expected);
  });

  it('tracks the last visible contents sentinel', () => {
    expect(LAST_VISIBLE_CONTENTS).toBe(CONTENTS_MIST);
  });
});

describe('content masks match rerelease definitions', () => {
  it('builds MASK_SOLID identical to game.h', () => {
    expect(MASK_SOLID).toBe(CONTENTS_SOLID | CONTENTS_WINDOW);
  });

  it('combines current bits for MASK_CURRENT', () => {
    const expected =
      CONTENTS_CURRENT_0 |
      CONTENTS_CURRENT_90 |
      CONTENTS_CURRENT_180 |
      CONTENTS_CURRENT_270 |
      CONTENTS_CURRENT_UP |
      CONTENTS_CURRENT_DOWN;
    expect(MASK_CURRENT).toBe(expected);
  });

  it('mirrors all remaining masks', () => {
    expect(MASK_PLAYERSOLID).toBe(
      CONTENTS_SOLID | CONTENTS_PLAYERCLIP | CONTENTS_WINDOW | CONTENTS_MONSTER | CONTENTS_PLAYER,
    );
    expect(MASK_DEADSOLID).toBe(CONTENTS_SOLID | CONTENTS_PLAYERCLIP | CONTENTS_WINDOW);
    expect(MASK_MONSTERSOLID).toBe(
      CONTENTS_SOLID | CONTENTS_MONSTERCLIP | CONTENTS_WINDOW | CONTENTS_MONSTER | CONTENTS_PLAYER,
    );
    expect(MASK_WATER).toBe(CONTENTS_WATER | CONTENTS_LAVA | CONTENTS_SLIME);
    expect(MASK_OPAQUE).toBe(CONTENTS_SOLID | CONTENTS_SLIME | CONTENTS_LAVA);
    expect(MASK_SHOT).toBe(
      CONTENTS_SOLID | CONTENTS_MONSTER | CONTENTS_PLAYER | CONTENTS_WINDOW | CONTENTS_DEADMONSTER,
    );
    expect(MASK_BLOCK_SIGHT).toBe(
      CONTENTS_SOLID | CONTENTS_LAVA | CONTENTS_SLIME | CONTENTS_MONSTER | CONTENTS_PLAYER,
    );
    expect(MASK_NAV_SOLID).toBe(CONTENTS_SOLID | CONTENTS_PLAYERCLIP | CONTENTS_WINDOW);
    expect(MASK_LADDER_NAV_SOLID).toBe(CONTENTS_SOLID | CONTENTS_WINDOW);
    expect(MASK_WALK_NAV_SOLID).toBe(
      CONTENTS_SOLID | CONTENTS_PLAYERCLIP | CONTENTS_WINDOW | CONTENTS_MONSTERCLIP,
    );
    expect(MASK_PROJECTILE).toBe(MASK_SHOT | CONTENTS_PROJECTILECLIP);
  });
});

describe('content helper functions', () => {
  it('detects when all requested flags are present', () => {
    const mask = CONTENTS_SOLID | CONTENTS_LAVA | CONTENTS_SLIME;
    expect(hasAllContents(mask, CONTENTS_SOLID)).toBe(true);
    expect(hasAllContents(mask, CONTENTS_SOLID | CONTENTS_SLIME)).toBe(true);
    expect(hasAllContents(mask, CONTENTS_WATER)).toBe(false);
  });

  it('detects when any flag is present', () => {
    const mask = CONTENTS_SOLID | CONTENTS_WATER;
    expect(hasAnyContents(mask, CONTENTS_WATER | CONTENTS_SLIME)).toBe(true);
    expect(hasAnyContents(mask, CONTENTS_SLIME)).toBe(false);
  });

  it('adds and removes flags immutably', () => {
    let mask = CONTENTS_SOLID;
    mask = addContents(mask, CONTENTS_WATER);
    expect(mask).toBe(CONTENTS_SOLID | CONTENTS_WATER);
    mask = removeContents(mask, CONTENTS_SOLID);
    expect(mask).toBe(CONTENTS_WATER);
  });
});

describe('surface flag helpers mirror surfflags_t', () => {
  const surfExpectations: Array<[string, number, number]> = [
    ['SURF_LIGHT', SURF_LIGHT, 1 << 0],
    ['SURF_SLICK', SURF_SLICK, 1 << 1],
    ['SURF_SKY', SURF_SKY, 1 << 2],
    ['SURF_WARP', SURF_WARP, 1 << 3],
    ['SURF_TRANS33', SURF_TRANS33, 1 << 4],
    ['SURF_TRANS66', SURF_TRANS66, 1 << 5],
    ['SURF_FLOWING', SURF_FLOWING, 1 << 6],
    ['SURF_NODRAW', SURF_NODRAW, 1 << 7],
    ['SURF_ALPHATEST', SURF_ALPHATEST, 1 << 25],
    ['SURF_N64_UV', SURF_N64_UV, 1 << 28],
    ['SURF_N64_SCROLL_X', SURF_N64_SCROLL_X, 1 << 29],
    ['SURF_N64_SCROLL_Y', SURF_N64_SCROLL_Y, 1 << 30],
    ['SURF_N64_SCROLL_FLIP', SURF_N64_SCROLL_FLIP, 1 << 31],
  ];

  it.each(surfExpectations)('%s matches rerelease bit position', (_label, actual, expected) => {
    expect(actual).toBe(expected);
  });

  it('combines and queries surface masks', () => {
    const mask = combineSurfaceFlags(SURF_LIGHT, SURF_FLOWING, SURF_ALPHATEST);
    expect(mask & SURF_LIGHT).not.toBe(0);
    expect(hasSurfaceFlags(mask, SURF_LIGHT | SURF_FLOWING)).toBe(true);
    expect(hasSurfaceFlags(mask, SURF_NODRAW)).toBe(false);
  });

  it('treats SURF_NONE as an empty mask', () => {
    expect(combineSurfaceFlags()).toBe(SURF_NONE);
  });
});
