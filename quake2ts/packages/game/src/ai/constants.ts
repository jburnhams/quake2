export const RANGE_MELEE = 20; // bboxes basically touching
export const RANGE_NEAR = 440;
export const RANGE_MID = 940;

export const FL_NOTARGET = 1 << 5;
export const FL_NOVISIBLE = 1 << 24; // super invisibility
export const SPAWNFLAG_MONSTER_AMBUSH = 1 << 0;

export enum AIFlags {
  StandGround = 1 << 0,
  TempStandGround = 1 << 1,
  SoundTarget = 1 << 2,
  LostSight = 1 << 3,
  PursuitLastSeen = 1 << 4,
  PursueNext = 1 << 5,
  PursueTemp = 1 << 6,
  HoldFrame = 1 << 7,
  GoodGuy = 1 << 8,
  Brutal = 1 << 9,
  NoStep = 1 << 10,
  ManualSteering = 1 << 11,
  Ducked = 1 << 12,
  CombatPoint = 1 << 13,
  Medic = 1 << 14,
  Resurrecting = 1 << 15,
  Pathing = 1 << 30, // Custom?
}

export enum AttackState {
  Straight = 0,
  Sliding = 1,
  Melee = 2,
  Missile = 3,
  Blind = 4,
}

// Alias for convenience/porting
export const MonsterAttackState = AttackState;

export enum TraceMask {
  Opaque = 1 << 0,
  Window = 1 << 1,
}
