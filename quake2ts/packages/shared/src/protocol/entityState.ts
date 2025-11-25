import { Vec3 } from '../math/vec3.js';

export interface EntityState {
  readonly number: number;
  readonly origin: Vec3;
  readonly angles: Vec3;
  readonly modelIndex: number;
  readonly frame: number;
  readonly skinNum: number;
  readonly effects: number;
  readonly renderfx: number;
  readonly solid: number;
  readonly sound?: number;
  readonly event?: number;
}
