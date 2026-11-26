/**
 * Weapon identifiers shared across game and cgame.
 * Reference: rerelease/g_items.cpp, game/src/inventory/playerInventory.ts
 */

export enum WeaponId {
  Blaster = 'blaster',
  Shotgun = 'shotgun',
  SuperShotgun = 'supershotgun', // Matched to assets (w_supershotgun, weapon_supershotgun)
  Machinegun = 'machinegun',
  Chaingun = 'chaingun',
  HandGrenade = 'grenades', // Matched to assets (w_grenades, weapon_grenades)
  GrenadeLauncher = 'grenadelauncher', // Matched to assets (w_grenadelauncher)
  RocketLauncher = 'rocketlauncher', // Matched to assets (w_rocketlauncher)
  HyperBlaster = 'hyperblaster',
  Railgun = 'railgun',
  BFG10K = 'bfg10k',
  // New additions for demo playback and extended support
  Grapple = 'grapple',
  ChainFist = 'chainfist',
  EtfRifle = 'etf_rifle', // Confirm asset?
  ProxLauncher = 'prox_launcher', // Confirm asset?
  IonRipper = 'ionripper',
  PlasmaBeam = 'plasmabeam',
  Phalanx = 'phalanx',
  Disruptor = 'disruptor',
  Trap = 'trap',
}
