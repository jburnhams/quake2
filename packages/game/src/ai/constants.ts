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
  SpawnedCarrier = 1 << 16,
  IgnoreShots = 1 << 17,
  AlternateFly = 1 << 18,
  Dodging = 1 << 19,
  ThirdEye = 1 << 20,
  /** AI_DO_NOT_COUNT: not counted in the level's monster total. */
  DoNotCount = 1 << 21,
  /** AI_CHARGING: runs straight at its enemy. */
  Charging = 1 << 22,
  SpawnedMedicC = 1 << 23,
  HintPath = 1 << 24, // Added based on m_move.cpp
  Blocked = 1 << 25, // Added AI_BLOCKED
  /** [Paril-KEX] for spawning dead */
  SpawnedAlive = 1 << 26,
  SpawnedDead = 1 << 27,
  /** AI_TARGET_ANGER: angry at a target_anger's target. */
  TargetAnger = 1 << 28,
  /** AI_TEMP_MELEE_COMBAT: temporarily switch to the melee combat style. */
  TempMeleeCombat = 1 << 29,
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

export const BOTTOM_EMPTY = 0;
export const BOTTOM_SOLID = 1;
export const BOTTOM_WATER = 2;
export const BOTTOM_SLIME = 3;
export const BOTTOM_LAVA = 4;
