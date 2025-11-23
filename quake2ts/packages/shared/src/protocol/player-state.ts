
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
  centerPrint?: string;
  notify?: string;
}
