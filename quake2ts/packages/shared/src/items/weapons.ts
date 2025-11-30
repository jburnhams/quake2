/**
 * Weapon identifiers shared across game and cgame.
 * Reference: rerelease/g_items.cpp, game/src/inventory/playerInventory.ts
 */

export enum WeaponId {
  Blaster = 'blaster',
  Shotgun = 'shotgun',
  SuperShotgun = 'super_shotgun',
  Machinegun = 'machinegun',
  Chaingun = 'chaingun',
  HandGrenade = 'hand_grenade',
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
