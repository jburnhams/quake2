// =================================================================
// Quake II - Weapon Definitions and Firing Logic
// =================================================================

import { Vec3 } from '@quake2ts/shared';
import { Entity } from '../entities/entity.js';

export enum WeaponType {
  BLASTER,
  SHOTGUN,
  SUPER_SHOTGUN,
  MACHINEGUN,
  CHAINGUN,
  GRENADE_LAUNCHER,
  ROCKET_LAUNCHER,
  HYPERBLASTER,
  RAILGUN,
  BFG10K,
}

export interface Weapon {
  type: WeaponType;
  name: string;
  ammo: string | null;
  damage: number;
  fireRate: number; // in seconds
  spread: number;
  projectileSpeed: number | null;
}

export const WEAPONS: Record<WeaponType, Weapon> = {
  [WeaponType.BLASTER]: {
    type: WeaponType.BLASTER,
    name: 'Blaster',
    ammo: null,
    damage: 15,
    fireRate: 0.5,
    spread: 0,
    projectileSpeed: 1000,
  },
  [WeaponType.SHOTGUN]: {
    type: WeaponType.SHOTGUN,
    name: 'Shotgun',
    ammo: 'shells',
    damage: 4,
    fireRate: 1,
    spread: 0.1,
    projectileSpeed: null,
  },
  // TODO: Add other weapons
  [WeaponType.SUPER_SHOTGUN]: {
    type: WeaponType.SUPER_SHOTGUN,
    name: 'Super Shotgun',
    ammo: 'shells',
    damage: 6,
    fireRate: 1.2,
    spread: 0.2,
    projectileSpeed: null,
  },
  [WeaponType.MACHINEGUN]: {
    type: WeaponType.MACHINEGUN,
    name: 'Machinegun',
    ammo: 'bullets',
    damage: 8,
    fireRate: 0.1,
    spread: 0.05,
    projectileSpeed: null,
  },
  [WeaponType.CHAINGUN]: {
    type: WeaponType.CHAINGUN,
    name: 'Chaingun',
    ammo: 'bullets',
    damage: 8,
    fireRate: 0.05,
    spread: 0.1,
    projectileSpeed: null,
  },
  [WeaponType.GRENADE_LAUNCHER]: {
    type: WeaponType.GRENADE_LAUNCHER,
    name: 'Grenade Launcher',
    ammo: 'grenades',
    damage: 120,
    fireRate: 1,
    spread: 0,
    projectileSpeed: 600,
  },
  [WeaponType.ROCKET_LAUNCHER]: {
    type: WeaponType.ROCKET_LAUNCHER,
    name: 'Rocket Launcher',
    ammo: 'rockets',
    damage: 100,
    fireRate: 1.2,
    spread: 0,
    projectileSpeed: 650,
  },
  [WeaponType.HYPERBLASTER]: {
    type: WeaponType.HYPERBLASTER,
    name: 'HyperBlaster',
    ammo: 'cells',
    damage: 20,
    fireRate: 0.1,
    spread: 0,
    projectileSpeed: 1000,
  },
  [WeaponType.RAILGUN]: {
    type: WeaponType.RAILGUN,
    name: 'Railgun',
    ammo: 'slugs',
    damage: 150,
    fireRate: 1.5,
    spread: 0,
    projectileSpeed: null,
  },
  [WeaponType.BFG10K]: {
    type: WeaponType.BFG10K,
    name: 'BFG10K',
    ammo: 'cells',
    damage: 200,
    fireRate: 2,
    spread: 0,
    projectileSpeed: 400,
  },
};
