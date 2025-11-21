import { ARMOR_INFO, ArmorType, type RegularArmorState } from '../combat/armor.js';
import {
  AmmoInventory,
  AmmoItemId,
  AmmoType,
  AmmoAdjustmentResult,
  AmmoCaps,
  AmmoSeed,
  addAmmo,
  createAmmoInventory,
  pickupAmmo,
} from './ammo.js';
import { ArmorItem, HealthItem, WeaponItem, PowerupItem, KeyItem, ARMOR_ITEMS } from './items.js';
import { PlayerWeaponStates, createPlayerWeaponStates } from '../combat/weapons/state.js';

export enum WeaponId {
  Blaster = 'blaster',
  Shotgun = 'shotgun',
  SuperShotgun = 'super_shotgun',
  Machinegun = 'machinegun',
  Chaingun = 'chaingun',
  GrenadeLauncher = 'grenade_launcher',
  RocketLauncher = 'rocket_launcher',
  HyperBlaster = 'hyperblaster',
  Railgun = 'railgun',
  BFG10K = 'bfg10k',
}

export enum PowerupId {
  QuadDamage = 'quad',
  Invulnerability = 'invulnerability',
  EnviroSuit = 'enviro_suit',
  Rebreather = 'rebreather',
  Silencer = 'silencer',
}

export enum KeyId {
  Blue = 'blue',
  Red = 'red',
  Green = 'green',
  Yellow = 'yellow',
}

export interface PlayerInventoryOptions {
  readonly ammoCaps?: AmmoCaps;
  readonly ammo?: AmmoSeed;
  readonly weapons?: readonly WeaponId[];
  readonly currentWeapon?: WeaponId;
  readonly armor?: RegularArmorState | null;
  readonly powerups?: Iterable<[PowerupId, number | null]>;
  readonly keys?: readonly KeyId[];
}

export interface PlayerInventory {
  readonly ammo: AmmoInventory;
  readonly ownedWeapons: Set<WeaponId>;
  currentWeapon?: WeaponId;
  armor: RegularArmorState | null;
  readonly powerups: Map<PowerupId, number | null>;
  readonly keys: Set<KeyId>;
}

export interface PlayerClient {
    inventory: PlayerInventory;
    weaponStates: PlayerWeaponStates;
}

export function createPlayerInventory(options: PlayerInventoryOptions = {}): PlayerInventory {
  const ammo = createAmmoInventory(options.ammoCaps, options.ammo);
  const ownedWeapons = new Set(options.weapons ?? []);
  const powerups = new Map<PowerupId, number | null>(options.powerups ?? []);
  const keys = new Set(options.keys ?? []);

  return {
    ammo,
    ownedWeapons,
    currentWeapon: options.currentWeapon,
    armor: options.armor ?? null,
    powerups,
    keys,
  };
}

export function giveAmmo(inventory: PlayerInventory, ammoType: AmmoType, amount: number): AmmoAdjustmentResult {
  return addAmmo(inventory.ammo, ammoType, amount);
}

export function giveAmmoItem(
  inventory: PlayerInventory,
  itemId: AmmoItemId,
  options?: Parameters<typeof pickupAmmo>[2],
): AmmoAdjustmentResult {
  return pickupAmmo(inventory.ammo, itemId, options);
}

export function giveWeapon(inventory: PlayerInventory, weapon: WeaponId, select = false): boolean {
  const hadWeapon = inventory.ownedWeapons.has(weapon);
  inventory.ownedWeapons.add(weapon);
  if (select || !inventory.currentWeapon) {
    inventory.currentWeapon = weapon;
  }
  return !hadWeapon;
}

export function hasWeapon(inventory: PlayerInventory, weapon: WeaponId): boolean {
  return inventory.ownedWeapons.has(weapon);
}

export function selectWeapon(inventory: PlayerInventory, weapon: WeaponId): boolean {
  if (!inventory.ownedWeapons.has(weapon)) {
    return false;
  }
  inventory.currentWeapon = weapon;
  return true;
}

export function equipArmor(inventory: PlayerInventory, armorType: ArmorType | null, amount: number): RegularArmorState | null {
  if (!armorType || amount <= 0) {
    inventory.armor = null;
    return null;
  }

  const info = ARMOR_INFO[armorType];
  const armorCount = Math.min(amount, info.maxCount);
  inventory.armor = { armorType, armorCount };
  return inventory.armor;
}

export function addPowerup(inventory: PlayerInventory, powerup: PowerupId, expiresAt: number | null): void {
  inventory.powerups.set(powerup, expiresAt);
}

export function hasPowerup(inventory: PlayerInventory, powerup: PowerupId): boolean {
  return inventory.powerups.has(powerup);
}

export function clearExpiredPowerups(inventory: PlayerInventory, nowMs: number): void {
  for (const [id, expiresAt] of inventory.powerups.entries()) {
    if (expiresAt !== null && expiresAt <= nowMs) {
      inventory.powerups.delete(id);
    }
  }
}

export function addKey(inventory: PlayerInventory, key: KeyId): boolean {
  const before = inventory.keys.size;
  inventory.keys.add(key);
  return inventory.keys.size > before;
}

export function hasKey(inventory: PlayerInventory, key: KeyId): boolean {
  return inventory.keys.has(key);
}

export function canPickupHealth(inventory: PlayerInventory, health: number, item: HealthItem): boolean {
    if (health >= item.max) {
        return false;
    }

    return true;
}

export function pickupArmor(inventory: PlayerInventory, item: ArmorItem): boolean {
    let armorType: ArmorType | null = null;
    if (item.id === 'item_armor_jacket') {
        armorType = ArmorType.JACKET;
    } else if (item.id === 'item_armor_combat') {
        armorType = ArmorType.COMBAT;
    } else if (item.id === 'item_armor_body') {
        armorType = ArmorType.BODY;
    }

    if (armorType) {
        const armorInfo = ARMOR_INFO[armorType];
        if (!inventory.armor || inventory.armor.armorType !== armorType) {
            inventory.armor = { armorType, armorCount: item.amount };
        } else {
            inventory.armor.armorCount += item.amount;
            if (inventory.armor.armorCount > armorInfo.maxCount) {
                inventory.armor.armorCount = armorInfo.maxCount;
            }
        }
        return true;
    }

    if (item.id === 'item_armor_shard') {
        if (!inventory.armor) {
            return false;
        }
        inventory.armor.armorCount += item.amount;
        const armorInfo = ARMOR_INFO[inventory.armor.armorType!];
        if (inventory.armor.armorCount > armorInfo.maxCount) {
            inventory.armor.armorCount = armorInfo.maxCount;
        }
        return true;
    }

    return false;
}

export function pickupPowerup(inventory: PlayerInventory, item: PowerupItem, time: number): boolean {
    let powerupId: PowerupId | null = null;

    switch (item.id) {
        case 'item_quad':
            powerupId = PowerupId.QuadDamage;
            break;
        case 'item_invulnerability':
            powerupId = PowerupId.Invulnerability;
            break;
        case 'item_silencer':
            powerupId = PowerupId.Silencer;
            break;
        case 'item_rebreather':
            powerupId = PowerupId.Rebreather;
            break;
        case 'item_enviro':
            powerupId = PowerupId.EnviroSuit;
            break;
    }

    if (powerupId) {
        const expiresAt = inventory.powerups.get(powerupId);
        if (expiresAt && expiresAt > time) {
            inventory.powerups.set(powerupId, expiresAt + item.timer);
        } else {
            inventory.powerups.set(powerupId, time + item.timer);
        }
        return true;
    }

    return false;
}

export function pickupKey(inventory: PlayerInventory, item: KeyItem): boolean {
    let keyId: KeyId | null = null;

    switch (item.id) {
        case 'key_blue':
            keyId = KeyId.Blue;
            break;
        case 'key_red':
            keyId = KeyId.Red;
            break;
        case 'key_green':
            keyId = KeyId.Green;
            break;
        case 'key_yellow':
            keyId = KeyId.Yellow;
            break;
    }

    if (keyId) {
        return addKey(inventory, keyId);
    }

    return false;
}

export function pickupWeapon(inventory: PlayerInventory, weaponItem: WeaponItem): boolean {
  const hadWeapon = hasWeapon(inventory, weaponItem.weaponId);
  let ammoAdded = false;

  if (weaponItem.ammoType) {
      const ammoToAdd = hadWeapon ? weaponItem.pickupAmmo : weaponItem.initialAmmo;
      const result = addAmmo(inventory.ammo, weaponItem.ammoType, ammoToAdd);
      ammoAdded = result.pickedUp;
  }

  if (hadWeapon && !ammoAdded) {
      return false;
  }

  giveWeapon(inventory, weaponItem.weaponId, true);

  return true;
}
  
export interface SerializedPlayerInventory {
  readonly ammo: readonly number[];
  readonly ownedWeapons: readonly WeaponId[];
  readonly currentWeapon?: WeaponId;
  readonly armor: RegularArmorState | null;
  readonly powerups: readonly [PowerupId, number | null][];
  readonly keys: readonly KeyId[];
}

export function serializePlayerInventory(inventory: PlayerInventory): SerializedPlayerInventory {
  return {
    ammo: inventory.ammo.counts,
    ownedWeapons: [...inventory.ownedWeapons],
    currentWeapon: inventory.currentWeapon,
    armor: inventory.armor ? { ...inventory.armor } : null,
    powerups: [...inventory.powerups.entries()],
    keys: [...inventory.keys],
  };
}

export function deserializePlayerInventory(
  serialized: SerializedPlayerInventory,
  options: PlayerInventoryOptions = {},
): PlayerInventory {
  const ammo = createAmmoInventory(options.ammoCaps);
  const limit = Math.min(ammo.counts.length, serialized.ammo.length);
  for (let i = 0; i < limit; i++) {
    ammo.counts[i] = serialized.ammo[i];
  }

  return {
    ammo,
    ownedWeapons: new Set(serialized.ownedWeapons),
    currentWeapon: serialized.currentWeapon,
    armor: serialized.armor ? { ...serialized.armor } : null,
    powerups: new Map(serialized.powerups),
    keys: new Set(serialized.keys),
  };
}
