
import { Vec3 } from '../math/vec3.js';

import { WaterLevel } from '../pmove/constants.js';

export interface DamageIndicator {
    direction: Vec3;
    strength: number;
}

export interface PlayerState {
  origin: Vec3;
  velocity: Vec3;
  viewAngles: Vec3;
  onGround: boolean;
  waterLevel: WaterLevel;
  mins: Vec3;
  maxs: Vec3;
  damageAlpha: number;
  damageIndicators: DamageIndicator[];
  blend: [number, number, number, number]; // r, g, b, a
  pickupIcon?: string; // Name of the icon to draw (e.g. 'w_railgun')
  centerPrint?: string;
  notify?: string;

  // Stats array (STAT_HEALTH, STAT_AMMO, etc.)
  stats: number[];

  // View effects
  kick_angles: Vec3;
  gunoffset: Vec3;
  gunangles: Vec3;
  gunindex: number;

  // New fields for Q2 network compatibility
  pm_type: number;
  pm_time: number;
  pm_flags: number;
  gun_frame: number;
  rdflags: number;
  fov: number;
}
