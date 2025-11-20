
import { Vec3 } from '../math/vec3.js';

import { WaterLevel } from '../bsp/contents.js';

export interface PlayerState {
  origin: Vec3;
  velocity: Vec3;
  onGround: boolean;
  waterLevel: WaterLevel;
  mins: Vec3;
  maxs: Vec3;
}
