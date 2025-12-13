import { PlayerStat } from '@quake2ts/shared';

export interface HudData {
  health: number;
  armor: number;
  ammo: number;
  ammoIcon?: string;
  weaponIcon?: string;
  pickupIcon?: string;
  inventory: { name: string; count: number; icon?: string }[];
  damageIndicators: { angle: number; alpha: number }[];
  fps: number;
}

export interface StatusBarData {
  health: number;
  armor: number;
  ammo: number;
  ammoIcon?: string;
  armorIcon?: string;
  selectedAmmoIndex: number;
}

export interface CrosshairInfo {
  index: number;
  name: string;
}
