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
import { ArmorItem, HealthItem, WeaponItem, PowerupItem, KeyItem, PowerArmorItem, ARMOR_ITEMS, WEAPON_ITEMS } from './items.js';
import { PlayerWeaponStates, createPlayerWeaponStates } from '../combat/weapons/state.js';
import { Vec3 } from '@quake2ts/shared';

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
  // New additions for demo playback and extended support
  Grapple = 'grapple',
  ChainFist = 'chainfist',
  EtfRifle = 'etf_rifle',
  ProxLauncher = 'prox_launcher',
  IonRipper = 'ionripper',
  PlasmaBeam = 'plasmabeam',
  Phalanx = 'phalanx',
  Disruptor = 'disruptor',
}

export enum PowerupId {
  QuadDamage = 'quad',
  Invulnerability = 'invulnerability',
  EnviroSuit = 'enviro_suit',
  Rebreather = 'rebreather',
  Silencer = 'silencer',
  // New additions for demo playback and extended support
  PowerScreen = 'power_screen',
  PowerShield = 'power_shield',
  QuadFire = 'quad_fire',
  Invisibility = 'invisibility',
  Bandolier = 'bandolier',
  AmmoPack = 'ammo_pack',
  IRGoggles = 'ir_goggles',
  DoubleDamage = 'double_damage',
  SphereVengeance = 'sphere_vengeance',
  SphereHunter = 'sphere_hunter',
  SphereDefender = 'sphere_defender',
  Doppelganger = 'doppelganger',
  TagToken = 'tag_token',
  TechResistance = 'tech_resistance',
  TechStrength = 'tech_strength',
  TechHaste = 'tech_haste',
  TechRegeneration = 'tech_regeneration',
  Flashlight = 'flashlight',
  Compass = 'compass',
}

export enum KeyId {
  Blue = 'blue',
  Red = 'red',
  Green = 'green',
  Yellow = 'yellow',
  // New additions for demo playback and extended support
  DataCD = 'data_cd',
  PowerCube = 'power_cube',
  ExplosiveCharges = 'explosive_charges',
  PowerCore = 'power_core',
  Pyramid = 'pyramid',
  DataSpinner = 'data_spinner',
  Pass = 'pass',
  CommanderHead = 'commander_head',
  Airstrike = 'airstrike',
  NukeContainer = 'nuke_container',
  Nuke = 'nuke',
  RedFlag = 'red_flag',
  BlueFlag = 'blue_flag',
}

export interface PlayerInventoryOptions {
  readonly ammoCaps?: AmmoCaps;
  readonly ammo?: AmmoSeed;
  readonly weapons?: readonly WeaponId[];
  readonly currentWeapon?: WeaponId;
  readonly armor?: RegularArmorState | null;
  readonly powerups?: Iterable<[PowerupId, number | null]>;
  readonly keys?: readonly KeyId[];
  readonly items?: Iterable<string>;
}

export interface PlayerInventory {
  readonly ammo: AmmoInventory;
  readonly ownedWeapons: Set<WeaponId>;
  currentWeapon?: WeaponId;
  armor: RegularArmorState | null;
  readonly powerups: Map<PowerupId, number | null>;
  readonly keys: Set<KeyId>;
  readonly items: Set<string>;
  pickupItem?: string;
  pickupTime?: number;
}

export interface PlayerClient {
    inventory: PlayerInventory;
    weaponStates: PlayerWeaponStates;
    buttons: number;
    kick_angles?: Vec3;
    kick_origin?: Vec3;
    // Powerup timers (from rerelease/g_local.h)
    quad_time?: number;
    double_time?: number;
}

export function createPlayerInventory(options: PlayerInventoryOptions = {}): PlayerInventory {
  const ammo = createAmmoInventory(options.ammoCaps, options.ammo);
  const ownedWeapons = new Set(options.weapons ?? []);
  const powerups = new Map<PowerupId, number | null>(options.powerups ?? []);
  const keys = new Set(options.keys ?? []);
  const items = new Set(options.items ?? []);

  return {
    ammo,
    ownedWeapons,
    currentWeapon: options.currentWeapon,
    armor: options.armor ?? null,
    powerups,
    keys,
    items,
  };
}

export function setPickup(inventory: PlayerInventory, item: string, time: number) {
    inventory.pickupItem = item;
    inventory.pickupTime = time;
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

export function hasItem(inventory: PlayerInventory, item: string): boolean {
    return inventory.items.has(item);
}

export function canPickupHealth(inventory: PlayerInventory, health: number, item: HealthItem): boolean {
    if (health >= item.max) {
        return false;
    }

    return true;
}

export function pickupArmor(inventory: PlayerInventory, item: ArmorItem, time: number): boolean {
    let armorType: ArmorType | null = null;
    let icon = '';
    if (item.id === 'item_armor_jacket') {
        armorType = ArmorType.JACKET;
        icon = 'i_jacketarmor';
    } else if (item.id === 'item_armor_combat') {
        armorType = ArmorType.COMBAT;
        icon = 'i_combatarmor';
    } else if (item.id === 'item_armor_body') {
        armorType = ArmorType.BODY;
        icon = 'i_bodyarmor';
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
        setPickup(inventory, icon, time);
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

export function pickupPowerup(client: PlayerClient, item: PowerupItem, time: number): boolean {
    const inventory = client.inventory;
    let powerupId: PowerupId | null = null;
    let icon = '';

    switch (item.id) {
        case 'item_quad':
            powerupId = PowerupId.QuadDamage;
            icon = 'p_quad';
            break;
        case 'item_invulnerability':
            powerupId = PowerupId.Invulnerability;
            icon = 'p_invulnerability';
            break;
        case 'item_silencer':
            powerupId = PowerupId.Silencer;
            icon = 'p_silencer';
            break;
        case 'item_rebreather':
            powerupId = PowerupId.Rebreather;
            icon = 'p_rebreather';
            break;
        case 'item_enviro':
            powerupId = PowerupId.EnviroSuit;
            icon = 'p_envirosuit';
            break;
    }

    if (powerupId) {
        const expiresAt = inventory.powerups.get(powerupId);
        const newExpiresAt = (expiresAt && expiresAt > time) ? expiresAt + item.timer * 1000 : time + item.timer * 1000;
        inventory.powerups.set(powerupId, newExpiresAt);

        if (powerupId === PowerupId.QuadDamage) {
            client.quad_time = newExpiresAt / 1000;
        } else if (powerupId === PowerupId.DoubleDamage) {
            client.double_time = newExpiresAt / 1000;
        }

        setPickup(inventory, icon, time);
        return true;
    }

    return false;
}

export function pickupPowerArmor(inventory: PlayerInventory, item: PowerArmorItem, time: number): boolean {
    let icon = '';
    if (item.armorType === 'screen') {
        icon = 'i_powerscreen';
    } else if (item.armorType === 'shield') {
        icon = 'i_powershield';
    }

    // You can have both screen and shield in inventory?
    // Q2 rerelease logic:
    // If you pick up power screen, you get it.
    // If you pick up power shield, you get it.
    // T_Damage prioritizes shield if you have cells.

    const hadIt = inventory.items.has(item.id);
    inventory.items.add(item.id);

    if (!hadIt) {
        setPickup(inventory, icon, time);
        return true;
    }

    // If already had it, give cells if applicable?
    // In Q2, power armor item gives 50 cells?
    // g_items.c:
    // "Power Screen" -> pickup "You got the Power Screen" -> IT_ARMOR
    // It doesn't seem to give cells by default unless specified.
    // But usually power armor implies battery consumption.
    // Rerelease might differ.
    // Let's stick to "just sets the flag".

    return false;
}

export function pickupKey(inventory: PlayerInventory, item: KeyItem, time: number): boolean {
    let keyId: KeyId | null = null;
    let icon = '';

    switch (item.id) {
        case 'key_blue':
            keyId = KeyId.Blue;
            icon = 'k_bluekey';
            break;
        case 'key_red':
            keyId = KeyId.Red;
            icon = 'k_redkey';
            break;
        case 'key_green':
            keyId = KeyId.Green;
            icon = 'k_security'; // Approx mapping
            break;
        case 'key_yellow':
            keyId = KeyId.Yellow;
            icon = 'k_pyramid'; // Approx mapping
            break;
    }

    if (keyId) {
        const res = addKey(inventory, keyId);
        if (res) setPickup(inventory, icon, time);
        return res;
    }

    return false;
}

export function pickupWeapon(inventory: PlayerInventory, weaponItem: WeaponItem, time: number): boolean {
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

  // Icon name for weapon
  // weaponItem.id is like 'weapon_railgun'
  // icons are 'w_railgun'
  const icon = `w_${weaponItem.id.substring(7)}`;
  setPickup(inventory, icon, time);

  return true;
}
  
export interface SerializedPlayerInventory {
  readonly ammo: readonly number[];
  readonly ownedWeapons: readonly WeaponId[];
  readonly currentWeapon?: WeaponId;
  readonly armor: RegularArmorState | null;
  readonly powerups: readonly [PowerupId, number | null][];
  readonly keys: readonly KeyId[];
  readonly items: readonly string[];
}

export function serializePlayerInventory(inventory: PlayerInventory): SerializedPlayerInventory {
  return {
    ammo: inventory.ammo.counts,
    ownedWeapons: [...inventory.ownedWeapons],
    currentWeapon: inventory.currentWeapon,
    armor: inventory.armor ? { ...inventory.armor } : null,
    powerups: [...inventory.powerups.entries()],
    keys: [...inventory.keys],
    items: [...inventory.items],
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
    items: new Set(serialized.items),
  };
}
