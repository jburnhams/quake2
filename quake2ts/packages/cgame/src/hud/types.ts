/**
 * Local type definitions for HUD components.
 * These types represent the minimal data structures needed for HUD rendering.
 * TODO: Refactor HUD to read from PlayerState.stats[] instead of inventory structure.
 */

import { WeaponId, PowerupId } from '@quake2ts/shared';

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

/**
 * Mapping from WeaponId to HUD icon names.
 * This avoids needing to import WEAPON_ITEMS from game package.
 */
export const WEAPON_ICON_MAP: Record<WeaponId, string> = {
  [WeaponId.Blaster]: 'w_blaster',
  [WeaponId.Shotgun]: 'w_shotgun',
  [WeaponId.SuperShotgun]: 'w_sshotgun',
  [WeaponId.Machinegun]: 'w_machinegun',
  [WeaponId.Chaingun]: 'w_chaingun',
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
};
