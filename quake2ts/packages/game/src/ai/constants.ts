export const RANGE_MELEE = 20; // bboxes basically touching
export const RANGE_NEAR = 440;
export const RANGE_MID = 940;

export const FL_NOVISIBLE = 1 << 24; // super invisibility
export const SPAWNFLAG_MONSTER_AMBUSH = 1 << 0;

export enum AIFlags {
  Pathing = 1 << 30,
}

export enum TraceMask {
  Opaque = 1 << 0,
  Window = 1 << 1,
}
