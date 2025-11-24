import { Vec3 } from '@quake2ts/shared';

export enum MuzzleFlash {
  TankBlaster1 = 1,
  TankBlaster2 = 2,
  TankBlaster3 = 3,
  TankMachinegun1 = 4,
  TankMachinegun2 = 5,
  TankMachinegun3 = 6,
  TankMachinegun4 = 7,
  TankMachinegun5 = 8,
  TankMachinegun6 = 9,
  TankMachinegun7 = 10,
  TankMachinegun8 = 11,
  TankMachinegun9 = 12,
  TankMachinegun10 = 13,
  TankMachinegun11 = 14,
  TankMachinegun12 = 15,
  TankMachinegun13 = 16,
  TankMachinegun14 = 17,
  TankMachinegun15 = 18,
  TankMachinegun16 = 19,
  TankMachinegun17 = 20,
  TankMachinegun18 = 21,
  TankMachinegun19 = 22,
  TankRocket1 = 23,
  TankRocket2 = 24,
  TankRocket3 = 25,

  InfantryMachinegun1 = 26,
  // ... skipped some for now, filling as needed

  SupertankMachinegun1 = 64,
  SupertankMachinegun2 = 65,
  SupertankMachinegun3 = 66,
  SupertankMachinegun4 = 67,
  SupertankMachinegun5 = 68,
  SupertankMachinegun6 = 69,
  SupertankRocket1 = 70,
  SupertankRocket2 = 71,
  SupertankRocket3 = 72,

  MakronBfg = 101,
  MakronBlaster1 = 102,
  MakronBlaster2 = 103,
  // ...
  MakronRailgun1 = 119,

  JorgMachinegunL1 = 120,
  JorgMachinegunL2 = 121,
  JorgMachinegunL3 = 122,
  JorgMachinegunL4 = 123,
  JorgMachinegunL5 = 124,
  JorgMachinegunL6 = 125,
  JorgMachinegunR1 = 126,
  JorgMachinegunR2 = 127,
  JorgMachinegunR3 = 128,
  JorgMachinegunR4 = 129,
  JorgMachinegunR5 = 130,
  JorgMachinegunR6 = 131,
  JorgBfg1 = 132,

  SupertankGrenade1 = 261,
  SupertankGrenade2 = 262,
}

export const MONSTER_FLASH_OFFSETS: Record<number, Vec3> = {
  [MuzzleFlash.TankBlaster1]: { x: 28.7, y: -18.5, z: 28.7 },
  [MuzzleFlash.TankBlaster2]: { x: 24.6, y: -21.5, z: 30.1 },
  [MuzzleFlash.TankBlaster3]: { x: 19.8, y: -23.9, z: 32.1 },

  [MuzzleFlash.TankMachinegun1]: { x: 22.9, y: -0.7, z: 25.3 },
  // ... fill others if needed

  [MuzzleFlash.TankRocket1]: { x: 6.2, y: 29.1, z: 49.1 },
  [MuzzleFlash.TankRocket2]: { x: 6.9, y: 23.8, z: 49.1 },
  [MuzzleFlash.TankRocket3]: { x: 8.3, y: 17.8, z: 49.5 },

  [MuzzleFlash.SupertankMachinegun1]: { x: 30.0, y: 39.0, z: 85.5 },
  [MuzzleFlash.SupertankMachinegun2]: { x: 30.0, y: 39.0, z: 85.5 },
  [MuzzleFlash.SupertankMachinegun3]: { x: 30.0, y: 39.0, z: 85.5 },
  [MuzzleFlash.SupertankMachinegun4]: { x: 30.0, y: 39.0, z: 85.5 },
  [MuzzleFlash.SupertankMachinegun5]: { x: 30.0, y: 39.0, z: 85.5 },
  [MuzzleFlash.SupertankMachinegun6]: { x: 30.0, y: 39.0, z: 85.5 },

  [MuzzleFlash.SupertankRocket1]: { x: 16.0, y: -22.5, z: 108.7 },
  [MuzzleFlash.SupertankRocket2]: { x: 16.0, y: -33.4, z: 106.7 },
  [MuzzleFlash.SupertankRocket3]: { x: 16.0, y: -42.8, z: 104.7 },

  [MuzzleFlash.MakronBfg]: { x: 17.0, y: -19.5, z: 62.9 },
  [MuzzleFlash.MakronBlaster1]: { x: -3.6, y: -24.1, z: 59.5 },
  [MuzzleFlash.MakronRailgun1]: { x: 18.1, y: 7.8, z: 74.4 },

  [MuzzleFlash.JorgMachinegunL1]: { x: 78.5, y: -47.1, z: 96.0 },
  [MuzzleFlash.JorgMachinegunR1]: { x: 78.5, y: 46.7, z: 96.0 },
  [MuzzleFlash.JorgBfg1]: { x: 6.3, y: -9.0, z: 111.2 },

  [MuzzleFlash.SupertankGrenade1]: { x: 31.31, y: -37.0, z: 54.32 },
  [MuzzleFlash.SupertankGrenade2]: { x: 31.31, y: 37.0, z: 54.32 },
};
