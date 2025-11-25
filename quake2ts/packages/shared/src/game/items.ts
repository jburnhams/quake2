import { AmmoType } from "@quake2ts/game";

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

export interface BaseItem {
    id: string; // classname
    name: string; // pickup name
}

export interface WeaponItem extends BaseItem {
    type: 'weapon';
    weaponId: WeaponId;
    ammoType: AmmoType | null;
    initialAmmo: number;
    pickupAmmo: number;
    fireRate: number;
}

export const WEAPON_ITEMS: Record<string, WeaponItem> = {
    'weapon_blaster': {
        type: 'weapon',
        id: 'weapon_blaster',
        name: 'Blaster',
        weaponId: WeaponId.Blaster,
        ammoType: null,
        initialAmmo: 0,
        pickupAmmo: 0,
        fireRate: 0.5,
    },
    'weapon_shotgun': {
        type: 'weapon',
        id: 'weapon_shotgun',
        name: 'Shotgun',
        weaponId: WeaponId.Shotgun,
        ammoType: AmmoType.Shells,
        initialAmmo: 10,
        pickupAmmo: 10,
        fireRate: 1,
    },
    'weapon_supershotgun': {
        type: 'weapon',
        id: 'weapon_supershotgun',
        name: 'Super Shotgun',
        weaponId: WeaponId.SuperShotgun,
        ammoType: AmmoType.Shells,
        initialAmmo: 10,
        pickupAmmo: 10,
        fireRate: 1,
    },
    'weapon_machinegun': {
        type: 'weapon',
        id: 'weapon_machinegun',
        name: 'Machinegun',
        weaponId: WeaponId.Machinegun,
        ammoType: AmmoType.Bullets,
        initialAmmo: 50,
        pickupAmmo: 50,
        fireRate: 0.1,
    },
    'weapon_chaingun': {
        type: 'weapon',
        id: 'weapon_chaingun',
        name: 'Chaingun',
        weaponId: WeaponId.Chaingun,
        ammoType: AmmoType.Bullets,
        initialAmmo: 50,
        pickupAmmo: 50,
        fireRate: 0.1,
    },
    'weapon_grenadelauncher': {
        type: 'weapon',
        id: 'weapon_grenadelauncher',
        name: 'Grenade Launcher',
        weaponId: WeaponId.GrenadeLauncher,
        ammoType: AmmoType.Grenades,
        initialAmmo: 10,
        pickupAmmo: 10,
        fireRate: 1,
    },
    'weapon_rocketlauncher': {
        type: 'weapon',
        id: 'weapon_rocketlauncher',
        name: 'Rocket Launcher',
        weaponId: WeaponId.RocketLauncher,
        ammoType: AmmoType.Rockets,
        initialAmmo: 5,
        pickupAmmo: 5,
        fireRate: 1,
    },
    'weapon_hyperblaster': {
        type: 'weapon',
        id: 'weapon_hyperblaster',
        name: 'HyperBlaster',
        weaponId: WeaponId.HyperBlaster,
        ammoType: AmmoType.Cells,
        initialAmmo: 50,
        pickupAmmo: 50,
        fireRate: 0.1,
    },
    'weapon_railgun': {
        type: 'weapon',
        id: 'weapon_railgun',
        name: 'Railgun',
        weaponId: WeaponId.Railgun,
        ammoType: AmmoType.Slugs,
        initialAmmo: 10,
        pickupAmmo: 10,
        fireRate: 1.5,
    },
    'weapon_bfg': {
        type: 'weapon',
        id: 'weapon_bfg',
        name: 'BFG10K',
        weaponId: WeaponId.BFG10K,
        ammoType: AmmoType.Cells,
        initialAmmo: 50,
        pickupAmmo: 50,
        fireRate: 1,
    },
};
