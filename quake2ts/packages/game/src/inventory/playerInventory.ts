import {
  type AmmoInventory,
  createAmmoInventory,
  type AmmoItemId,
  addAmmo,
  pickupAmmo,
  type AmmoAdjustmentResult,
  AmmoType,
} from './ammo.js';
import {
  WeaponId,
  PowerupId
} from '@quake2ts/shared';
import { ArmorType, ARMOR_INFO, type RegularArmorState } from '../combat/armor.js';
import { WeaponItem, ArmorItem, PowerupItem, PowerArmorItem, KeyItem, HealthItem } from './items.js';
import { PlayerWeaponStates, createPlayerWeaponStates } from '../combat/weapons/state.js';
import { Vec3, ZERO_VEC3 } from '@quake2ts/shared';
import { WeaponStateEnum } from '../combat/weapons/state.js';

export { WeaponId, PowerupId };

export interface PlayerInventoryOptions {
  readonly weapons?: readonly WeaponId[];
  readonly ammo?: Record<number, number>;
  readonly ammoCaps?: readonly number[];
  readonly currentWeapon?: WeaponId;
}

export enum KeyId {
  Blue = 'key_blue',
  Red = 'key_red',
  Green = 'key_green',
  Yellow = 'key_yellow',
  DataCD = 'key_data_cd',
  PowerCube = 'key_power_cube',
  ExplosiveCharges = 'key_explosive_charges',
  PowerCore = 'key_power_core',
  Pyramid = 'key_pyramid',
  DataSpinner = 'key_data_spinner',
  Pass = 'key_pass',
  CommanderHead = 'key_commander_head',
  Airstrike = 'key_airstrike',
  NukeContainer = 'key_nuke_container',
  Nuke = 'key_nuke',
  RedFlag = 'key_red_flag',
  BlueFlag = 'key_blue_flag',
}

export interface PlayerInventory {
  readonly ammo: AmmoInventory;
  readonly ownedWeapons: Set<WeaponId>;
  currentWeapon?: WeaponId;
  armor: RegularArmorState | null;
  readonly powerups: Map<PowerupId, number | null>; // id -> expiration time
  readonly keys: Set<KeyId>;
  readonly items: Set<string>; // Generic items like Power Screen/Shield
  // Pickup state
  pickupItem?: string;
  pickupTime?: number;
}

export interface FogState {
    density: number;
    r: number;
    g: number;
    b: number;
    sky_factor: number;
}

export interface HeightFogState {
    start_color: number[];
    end_color: number[];
    falloff: number;
    density: number;
}

export interface PlayerPersistentState {
    connected: boolean;
    inventory: number[]; // Indexable inventory if needed, or map to PlayerInventory
    health: number;
    max_health: number;
    savedFlags: number;
    selected_item: number;

    // KEX Fog fields
    wanted_fog?: FogState;
    wanted_heightfog?: HeightFogState;
    fog_transition_time?: number;

    // Additional fields as needed by original gclient_t.pers
    power_cubes?: number;
    helpchanged?: number;
    help_time?: number;
    game_help1changed?: number;
    game_help2changed?: number;
    netname?: string;
    spectator?: boolean;
}

export interface PlayerClient {
    inventory: PlayerInventory;
    weaponStates: PlayerWeaponStates;
    pers: PlayerPersistentState; // [Paril-KEX] Persistent state including fog
    buttons: number;
    // Movement
    pm_type: number;
    pm_time: number;
    pm_flags: number;
    gun_frame: number;
    rdflags: number; // View flags
    fov: number;
    // View kick
    kick_angles?: Vec3;
    kick_origin?: Vec3;
    v_angle?: Vec3; // Actual view angles (including kick?)
    // Powerups
    quad_time?: number;
    double_time?: number;
    invincible_time?: number;
    breather_time?: number;
    enviro_time?: number;
    quadsound_time?: number;
    // Weapon Animation System
    weaponstate?: WeaponStateEnum;
    weapon_think_time?: number;
    weapon_fire_finished?: number;
    weapon_sound?: number;
    // Grenade specific
    grenade_time?: number | null;
    grenade_finished_time?: number | null;
    grenade_blew_up?: boolean;
    // Animation
    anim_priority?: number;
    anim_end?: number;
    anim_time?: number;
    // Earthquakes
    quake_time?: number;
    // Additional fields
    landmark_name?: string | null;
    landmark_rel_pos?: Vec3;
    oldvelocity?: Vec3;
    oldviewangles?: Vec3;
    oldgroundentity?: any; // Entity
    owned_sphere?: any; // Entity
}

export function createPlayerInventory(init: PlayerInventoryOptions = {}): PlayerInventory {
  const ammoCaps = init.ammoCaps;
  const inv: PlayerInventory = {
    ammo: createAmmoInventory(ammoCaps),
    ownedWeapons: new Set(init.weapons ?? [WeaponId.Blaster]),
    armor: null,
    powerups: new Map(),
    keys: new Set(),
    items: new Set(),
  };

  if (init.ammo) {
    for (const [type, count] of Object.entries(init.ammo)) {
      inv.ammo.counts[Number(type)] = count;
    }
  }

  // Set default weapon if we have any
  if (init.currentWeapon) {
      inv.currentWeapon = init.currentWeapon;
  } else if (inv.ownedWeapons.size > 0) {
      // Prefer blaster, then shotgun, then first avail
      if (inv.ownedWeapons.has(WeaponId.Blaster)) inv.currentWeapon = WeaponId.Blaster;
      else if (inv.ownedWeapons.has(WeaponId.Shotgun)) inv.currentWeapon = WeaponId.Shotgun;
      else inv.currentWeapon = [...inv.ownedWeapons][0];
  }

  return inv;
}

function setPickup(inventory: PlayerInventory, item: string, time: number) {
    inventory.pickupItem = item;
    inventory.pickupTime = time;
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
            // Logic based on g_items.c: Pickup_Armor
            // If we have different armor, only take if new armor is better (higher protection).
            // This prevents replacing Body Armor (0.8) with Jacket Armor (0.3).
            let take = true;
            if (inventory.armor) {
                const oldInfo = ARMOR_INFO[inventory.armor.armorType!];
                if (oldInfo.normalProtection > armorInfo.normalProtection) {
                    take = false;
                }
            }

            if (take) {
                inventory.armor = { armorType, armorCount: item.amount };
                setPickup(inventory, icon, time);
                return true;
            } else {
                return false;
            }
        } else {
            // Same type, add count up to max
            inventory.armor.armorCount += item.amount;
            if (inventory.armor.armorCount > armorInfo.maxCount) {
                inventory.armor.armorCount = armorInfo.maxCount;
            }
            setPickup(inventory, icon, time);
            return true;
        }
    }

    if (item.id === 'item_armor_shard') {
        if (!inventory.armor) {
            // Shards give Jacket Armor (2) if player has no armor
            inventory.armor = { armorType: ArmorType.JACKET, armorCount: item.amount };
        } else {
            inventory.armor.armorCount += item.amount;
            const armorInfo = ARMOR_INFO[inventory.armor.armorType!];
            if (inventory.armor.armorCount > armorInfo.maxCount) {
                inventory.armor.armorCount = armorInfo.maxCount;
            }
        }
        // Shards do not trigger a pickup icon/timer in inventory slot
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
        case 'item_double':
            powerupId = PowerupId.DoubleDamage;
            icon = 'p_double';
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

    // Power Armor logic mirrors Quake 2:
    // Picking up screen/shield always gives the item.
    // T_Damage logic (damage.ts) handles priority and cell consumption.

    const hadIt = inventory.items.has(item.id);
    inventory.items.add(item.id);

    if (!hadIt) {
        setPickup(inventory, icon, time);
        return true;
    }

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
