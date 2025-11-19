/**
 * Bitflag constants mirroring the Quake II rerelease `contents_t` and
 * `surfflags_t` enumerations from `game.h`. The helpers here operate purely on
 * numeric bitmasks so both the authoritative game simulation and the client can
 * share the same semantic checks.
 */
export type ContentsFlag = number;
export type SurfaceFlag = number;

export const CONTENTS_NONE: ContentsFlag = 0;
export const CONTENTS_SOLID: ContentsFlag = 1 << 0;
export const CONTENTS_WINDOW: ContentsFlag = 1 << 1;
export const CONTENTS_AUX: ContentsFlag = 1 << 2;
export const CONTENTS_LAVA: ContentsFlag = 1 << 3;
export const CONTENTS_SLIME: ContentsFlag = 1 << 4;
export const CONTENTS_WATER: ContentsFlag = 1 << 5;
export const CONTENTS_MIST: ContentsFlag = 1 << 6;
export const CONTENTS_NO_WATERJUMP: ContentsFlag = 1 << 13;
export const CONTENTS_PROJECTILECLIP: ContentsFlag = 1 << 14;
export const CONTENTS_AREAPORTAL: ContentsFlag = 1 << 15;
export const CONTENTS_PLAYERCLIP: ContentsFlag = 1 << 16;
export const CONTENTS_MONSTERCLIP: ContentsFlag = 1 << 17;
export const CONTENTS_CURRENT_0: ContentsFlag = 1 << 18;
export const CONTENTS_CURRENT_90: ContentsFlag = 1 << 19;
export const CONTENTS_CURRENT_180: ContentsFlag = 1 << 20;
export const CONTENTS_CURRENT_270: ContentsFlag = 1 << 21;
export const CONTENTS_CURRENT_UP: ContentsFlag = 1 << 22;
export const CONTENTS_CURRENT_DOWN: ContentsFlag = 1 << 23;
export const CONTENTS_ORIGIN: ContentsFlag = 1 << 24;
export const CONTENTS_MONSTER: ContentsFlag = 1 << 25;
export const CONTENTS_DEADMONSTER: ContentsFlag = 1 << 26;
export const CONTENTS_DETAIL: ContentsFlag = 1 << 27;
export const CONTENTS_TRANSLUCENT: ContentsFlag = 1 << 28;
export const CONTENTS_LADDER: ContentsFlag = 1 << 29;
export const CONTENTS_PLAYER: ContentsFlag = 1 << 30;
export const CONTENTS_PROJECTILE: ContentsFlag = 1 << 31;

export const LAST_VISIBLE_CONTENTS: ContentsFlag = CONTENTS_MIST;

export const SURF_NONE: SurfaceFlag = 0;
export const SURF_LIGHT: SurfaceFlag = 1 << 0;
export const SURF_SLICK: SurfaceFlag = 1 << 1;
export const SURF_SKY: SurfaceFlag = 1 << 2;
export const SURF_WARP: SurfaceFlag = 1 << 3;
export const SURF_TRANS33: SurfaceFlag = 1 << 4;
export const SURF_TRANS66: SurfaceFlag = 1 << 5;
export const SURF_FLOWING: SurfaceFlag = 1 << 6;
export const SURF_NODRAW: SurfaceFlag = 1 << 7;
export const SURF_ALPHATEST: SurfaceFlag = 1 << 25;
export const SURF_N64_UV: SurfaceFlag = 1 << 28;
export const SURF_N64_SCROLL_X: SurfaceFlag = 1 << 29;
export const SURF_N64_SCROLL_Y: SurfaceFlag = 1 << 30;
export const SURF_N64_SCROLL_FLIP: SurfaceFlag = 1 << 31;

export const MASK_ALL: ContentsFlag = 0xffffffff;
export const MASK_SOLID: ContentsFlag = CONTENTS_SOLID | CONTENTS_WINDOW;
export const MASK_PLAYERSOLID: ContentsFlag =
  CONTENTS_SOLID | CONTENTS_PLAYERCLIP | CONTENTS_WINDOW | CONTENTS_MONSTER | CONTENTS_PLAYER;
export const MASK_DEADSOLID: ContentsFlag = CONTENTS_SOLID | CONTENTS_PLAYERCLIP | CONTENTS_WINDOW;
export const MASK_MONSTERSOLID: ContentsFlag =
  CONTENTS_SOLID | CONTENTS_MONSTERCLIP | CONTENTS_WINDOW | CONTENTS_MONSTER | CONTENTS_PLAYER;
export const MASK_WATER: ContentsFlag = CONTENTS_WATER | CONTENTS_LAVA | CONTENTS_SLIME;
export const MASK_OPAQUE: ContentsFlag = CONTENTS_SOLID | CONTENTS_SLIME | CONTENTS_LAVA;
export const MASK_SHOT: ContentsFlag =
  CONTENTS_SOLID | CONTENTS_MONSTER | CONTENTS_PLAYER | CONTENTS_WINDOW | CONTENTS_DEADMONSTER;
export const MASK_CURRENT: ContentsFlag =
  CONTENTS_CURRENT_0 |
  CONTENTS_CURRENT_90 |
  CONTENTS_CURRENT_180 |
  CONTENTS_CURRENT_270 |
  CONTENTS_CURRENT_UP |
  CONTENTS_CURRENT_DOWN;
export const MASK_BLOCK_SIGHT: ContentsFlag =
  CONTENTS_SOLID | CONTENTS_LAVA | CONTENTS_SLIME | CONTENTS_MONSTER | CONTENTS_PLAYER;
export const MASK_NAV_SOLID: ContentsFlag = CONTENTS_SOLID | CONTENTS_PLAYERCLIP | CONTENTS_WINDOW;
export const MASK_LADDER_NAV_SOLID: ContentsFlag = CONTENTS_SOLID | CONTENTS_WINDOW;
export const MASK_WALK_NAV_SOLID: ContentsFlag =
  CONTENTS_SOLID | CONTENTS_PLAYERCLIP | CONTENTS_WINDOW | CONTENTS_MONSTERCLIP;
export const MASK_PROJECTILE: ContentsFlag = MASK_SHOT | CONTENTS_PROJECTILECLIP;

export function hasAllContents(mask: ContentsFlag, flags: ContentsFlag): boolean {
  return (mask & flags) === flags;
}

export function hasAnyContents(mask: ContentsFlag, flags: ContentsFlag): boolean {
  return (mask & flags) !== 0;
}

export function addContents(mask: ContentsFlag, flags: ContentsFlag): ContentsFlag {
  return mask | flags;
}

export function removeContents(mask: ContentsFlag, flags: ContentsFlag): ContentsFlag {
  return mask & ~flags;
}

export function hasSurfaceFlags(surface: SurfaceFlag, flags: SurfaceFlag): boolean {
  return (surface & flags) === flags;
}

export function combineSurfaceFlags(...flags: SurfaceFlag[]): SurfaceFlag {
  let mask = SURF_NONE;
  for (const flag of flags) {
    mask |= flag;
  }
  return mask;
}
