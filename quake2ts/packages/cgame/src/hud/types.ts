import type { LayoutFlags, PlayerState } from '@quake2ts/shared';
import { WeaponId, PowerupId } from '@quake2ts/shared';

// Local types for HUD state
export interface ArmorState {
  armorType: string;
  armorCount: number;
}

export interface InventoryState {
  armor: ArmorState | null;
  currentWeapon?: WeaponId;
  powerups: Map<PowerupId, number | null>;
  keys: Set<string>;
}

export interface ClientState {
  inventory: InventoryState;
}

export interface HUDContext {
  isplit: number;
  data: unknown; // Placeholder
  hud_vrect: { x: number, y: number, width: number, height: number };
  hud_safe: { x: number, y: number, width: number, height: number };
  scale: number;
  playernum: number;
  ps: PlayerState;
}

/**
 * Mapping from WeaponId to HUD icon names.
 */
export const WEAPON_ICON_MAP: Record<WeaponId, string> = {
  [WeaponId.Blaster]: 'w_blaster',
  [WeaponId.Shotgun]: 'w_shotgun',
  [WeaponId.SuperShotgun]: 'w_sshotgun',
  [WeaponId.Machinegun]: 'w_machinegun',
  [WeaponId.Chaingun]: 'w_chaingun',
  [WeaponId.HandGrenade]: 'w_grenade',
  [WeaponId.GrenadeLauncher]: 'w_glauncher',
  [WeaponId.RocketLauncher]: 'w_rlauncher',
  [WeaponId.HyperBlaster]: 'w_hyperblaster',
  [WeaponId.Railgun]: 'w_railgun',
  [WeaponId.BFG10K]: 'w_bfg',
  [WeaponId.Grapple]: 'w_grapple',
  [WeaponId.ChainFist]: 'w_chainfist',
  [WeaponId.EtfRifle]: 'w_etf_rifle',
  [WeaponId.ProxLauncher]: 'w_prox_launcher',
  [WeaponId.IonRipper]: 'w_ionripper',
  [WeaponId.PlasmaBeam]: 'w_plasmabeam',
  [WeaponId.Phalanx]: 'w_phalanx',
  [WeaponId.Disruptor]: 'w_disruptor',
  [WeaponId.Trap]: 'w_trap',
};
