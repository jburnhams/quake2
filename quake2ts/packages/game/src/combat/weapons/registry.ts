import { Entity } from '../../entities/entity.js';
import { GameExports } from '../../index.js';
import { WeaponId } from '../../inventory/playerInventory.js';
import { WeaponState } from './state.js';

export interface WeaponDefinition {
  weaponId: WeaponId;
  name: string;
  ammo: string | null;
  ammoUsage: number;
  fireRate: number; // For AI or basic logic

  // Callbacks
  fire: (game: GameExports, player: Entity, state: WeaponState) => void;
  // Optional animation logic customization
  // frames, skins, etc.
}

const CUSTOM_WEAPONS = new Map<WeaponId, WeaponDefinition>();

export function registerWeapon(def: WeaponDefinition): void {
  CUSTOM_WEAPONS.set(def.weaponId, def);
}

export function getWeaponDefinition(id: WeaponId): WeaponDefinition | undefined {
  return CUSTOM_WEAPONS.get(id);
}

// Hook to check for custom weapons in fire()
export function fireCustomWeapon(game: GameExports, player: Entity, weaponId: WeaponId, state: WeaponState): boolean {
  const def = CUSTOM_WEAPONS.get(weaponId);
  if (def) {
    def.fire(game, player, state);
    return true;
  }
  return false;
}
