export enum DamageFlags {
  NONE = 0,
  RADIUS = 0x00000001,
  NO_ARMOR = 0x00000002,
  ENERGY = 0x00000004,
  NO_KNOCKBACK = 0x00000008,
  BULLET = 0x00000010,
  NO_PROTECTION = 0x00000020,
  DESTROY_ARMOR = 0x00000040,
  NO_REG_ARMOR = 0x00000080,
  NO_POWER_ARMOR = 0x00000100,
  NO_INDICATOR = 0x00000200,
}

export function hasAnyDamageFlag(flags: number, mask: DamageFlags): boolean {
  return (flags & mask) !== 0;
}
