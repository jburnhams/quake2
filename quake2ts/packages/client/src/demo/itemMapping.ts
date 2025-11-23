import { WeaponId, PowerupId, KeyId } from '@quake2ts/game';
import { AmmoType } from '@quake2ts/game';
import { ArmorType } from '@quake2ts/game';

export type ItemMappingType =
  | { type: 'weapon'; id: WeaponId }
  | { type: 'ammo'; id: AmmoType }
  | { type: 'armor'; id: ArmorType }
  | { type: 'powerup'; id: PowerupId }
  | { type: 'key'; id: KeyId }
  | { type: 'health'; id: string } // Health is usually handled specially or just ignored in inventory listing
  | { type: 'null' };

// Order based on item_id_t in g_local.h and itemlist in g_items.cpp
// This MUST match the original Quake 2 item index order.
export const DEMO_ITEM_MAPPING: ItemMappingType[] = [
    { type: 'null' }, // IT_NULL = 0

    // Armor
    { type: 'armor', id: ArmorType.BODY },        // IT_ARMOR_BODY
    { type: 'armor', id: ArmorType.COMBAT },      // IT_ARMOR_COMBAT
    { type: 'armor', id: ArmorType.JACKET },      // IT_ARMOR_JACKET
    { type: 'armor', id: ArmorType.JACKET },      // IT_ARMOR_SHARD (Handled as jacket in base game logic usually, or separate counter)

    // Power Armor
    { type: 'powerup', id: PowerupId.PowerScreen }, // IT_ITEM_POWER_SCREEN
    { type: 'powerup', id: PowerupId.PowerShield }, // IT_ITEM_POWER_SHIELD

    // Weapons
    { type: 'weapon', id: WeaponId.Grapple },     // IT_WEAPON_GRAPPLE
    { type: 'weapon', id: WeaponId.Blaster },     // IT_WEAPON_BLASTER
    { type: 'weapon', id: WeaponId.ChainFist },   // IT_WEAPON_CHAINFIST
    { type: 'weapon', id: WeaponId.Shotgun },     // IT_WEAPON_SHOTGUN
    { type: 'weapon', id: WeaponId.SuperShotgun },// IT_WEAPON_SSHOTGUN
    { type: 'weapon', id: WeaponId.Machinegun },  // IT_WEAPON_MACHINEGUN
    { type: 'weapon', id: WeaponId.EtfRifle },    // IT_WEAPON_ETF_RIFLE
    { type: 'weapon', id: WeaponId.Chaingun },    // IT_WEAPON_CHAINGUN

    // Ammo
    { type: 'ammo', id: AmmoType.Grenades },      // IT_AMMO_GRENADES
    { type: 'ammo', id: AmmoType.Trap },          // IT_AMMO_TRAP
    { type: 'ammo', id: AmmoType.Tesla },         // IT_AMMO_TESLA

    // Weapons cont.
    { type: 'weapon', id: WeaponId.GrenadeLauncher }, // IT_WEAPON_GLAUNCHER
    { type: 'weapon', id: WeaponId.ProxLauncher },    // IT_WEAPON_PROXLAUNCHER
    { type: 'weapon', id: WeaponId.RocketLauncher },  // IT_WEAPON_RLAUNCHER
    { type: 'weapon', id: WeaponId.HyperBlaster },    // IT_WEAPON_HYPERBLASTER
    { type: 'weapon', id: WeaponId.IonRipper },       // IT_WEAPON_IONRIPPER
    { type: 'weapon', id: WeaponId.PlasmaBeam },      // IT_WEAPON_PLASMABEAM
    { type: 'weapon', id: WeaponId.Railgun },         // IT_WEAPON_RAILGUN
    { type: 'weapon', id: WeaponId.Phalanx },         // IT_WEAPON_PHALANX
    { type: 'weapon', id: WeaponId.BFG10K },          // IT_WEAPON_BFG
    { type: 'weapon', id: WeaponId.Disruptor },       // IT_WEAPON_DISRUPTOR

    // Ammo
    { type: 'ammo', id: AmmoType.Shells },        // IT_AMMO_SHELLS
    { type: 'ammo', id: AmmoType.Bullets },       // IT_AMMO_BULLETS
    { type: 'ammo', id: AmmoType.Cells },         // IT_AMMO_CELLS
    { type: 'ammo', id: AmmoType.Rockets },       // IT_AMMO_ROCKETS
    { type: 'ammo', id: AmmoType.Slugs },         // IT_AMMO_SLUGS
    { type: 'ammo', id: AmmoType.MagSlugs },      // IT_AMMO_MAGSLUG
    { type: 'ammo', id: AmmoType.Flechettes },    // IT_AMMO_FLECHETTES
    { type: 'ammo', id: AmmoType.Prox },          // IT_AMMO_PROX
    { type: 'ammo', id: AmmoType.Nuke },          // IT_AMMO_NUKE
    { type: 'ammo', id: AmmoType.Rounds },        // IT_AMMO_ROUNDS

    // Items / Powerups
    { type: 'powerup', id: PowerupId.QuadDamage },      // IT_ITEM_QUAD
    { type: 'powerup', id: PowerupId.QuadFire },        // IT_ITEM_QUADFIRE
    { type: 'powerup', id: PowerupId.Invulnerability }, // IT_ITEM_INVULNERABILITY
    { type: 'powerup', id: PowerupId.Invisibility },    // IT_ITEM_INVISIBILITY
    { type: 'powerup', id: PowerupId.Silencer },        // IT_ITEM_SILENCER
    { type: 'powerup', id: PowerupId.Rebreather },      // IT_ITEM_REBREATHER
    { type: 'powerup', id: PowerupId.EnviroSuit },      // IT_ITEM_ENVIROSUIT
    { type: 'health', id: 'ancient_head' },             // IT_ITEM_ANCIENT_HEAD
    { type: 'health', id: 'legacy_head' },              // IT_ITEM_LEGACY_HEAD
    { type: 'health', id: 'adrenaline' },               // IT_ITEM_ADRENALINE
    { type: 'powerup', id: PowerupId.Bandolier },       // IT_ITEM_BANDOLIER
    { type: 'powerup', id: PowerupId.AmmoPack },        // IT_ITEM_PACK
    { type: 'powerup', id: PowerupId.IRGoggles },       // IT_ITEM_IR_GOGGLES
    { type: 'powerup', id: PowerupId.DoubleDamage },    // IT_ITEM_DOUBLE
    { type: 'powerup', id: PowerupId.SphereVengeance }, // IT_ITEM_SPHERE_VENGEANCE
    { type: 'powerup', id: PowerupId.SphereHunter },    // IT_ITEM_SPHERE_HUNTER
    { type: 'powerup', id: PowerupId.SphereDefender },  // IT_ITEM_SPHERE_DEFENDER
    { type: 'powerup', id: PowerupId.Doppelganger },    // IT_ITEM_DOPPELGANGER
    { type: 'powerup', id: PowerupId.TagToken },        // IT_ITEM_TAG_TOKEN

    // Keys
    { type: 'key', id: KeyId.DataCD },            // IT_KEY_DATA_CD
    { type: 'key', id: KeyId.PowerCube },         // IT_KEY_POWER_CUBE
    { type: 'key', id: KeyId.ExplosiveCharges },  // IT_KEY_EXPLOSIVE_CHARGES
    { type: 'key', id: KeyId.Yellow },            // IT_KEY_YELLOW
    { type: 'key', id: KeyId.PowerCore },         // IT_KEY_POWER_CORE
    { type: 'key', id: KeyId.Pyramid },           // IT_KEY_PYRAMID
    { type: 'key', id: KeyId.DataSpinner },       // IT_KEY_DATA_SPINNER
    { type: 'key', id: KeyId.Pass },              // IT_KEY_PASS
    { type: 'key', id: KeyId.Blue },              // IT_KEY_BLUE_KEY
    { type: 'key', id: KeyId.Red },               // IT_KEY_RED_KEY
    { type: 'key', id: KeyId.Green },             // IT_KEY_GREEN_KEY
    { type: 'key', id: KeyId.CommanderHead },     // IT_KEY_COMMANDER_HEAD
    { type: 'key', id: KeyId.Airstrike },         // IT_KEY_AIRSTRIKE
    { type: 'key', id: KeyId.NukeContainer },     // IT_KEY_NUKE_CONTAINER
    { type: 'key', id: KeyId.Nuke },              // IT_KEY_NUKE

    // Health
    { type: 'health', id: 'health_small' },       // IT_HEALTH_SMALL
    { type: 'health', id: 'health_medium' },      // IT_HEALTH_MEDIUM
    { type: 'health', id: 'health_large' },       // IT_HEALTH_LARGE
    { type: 'health', id: 'health_mega' },        // IT_HEALTH_MEGA

    // CTF
    { type: 'key', id: KeyId.RedFlag },           // IT_FLAG1
    { type: 'key', id: KeyId.BlueFlag },          // IT_FLAG2

    // Tech
    { type: 'powerup', id: PowerupId.TechResistance },   // IT_TECH_RESISTANCE
    { type: 'powerup', id: PowerupId.TechStrength },     // IT_TECH_STRENGTH
    { type: 'powerup', id: PowerupId.TechHaste },        // IT_TECH_HASTE
    { type: 'powerup', id: PowerupId.TechRegeneration }, // IT_TECH_REGENERATION

    { type: 'powerup', id: PowerupId.Flashlight }, // IT_ITEM_FLASHLIGHT
    { type: 'powerup', id: PowerupId.Compass },    // IT_ITEM_COMPASS
];
