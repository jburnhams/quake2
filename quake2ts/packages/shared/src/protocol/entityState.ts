import { Vec3 } from '../math/vec3.js';

export interface EntityState {
  readonly number: number;
  readonly origin: Vec3;
  readonly angles: Vec3;
  readonly oldOrigin?: Vec3; // [Paril-KEX] for lerping
  readonly modelIndex: number;
  readonly modelIndex2?: number; // [Paril-KEX]
  readonly modelIndex3?: number; // [Paril-KEX]
  readonly modelIndex4?: number; // [Paril-KEX]
  readonly frame: number;
  readonly skinNum: number;
  readonly effects: number;
  readonly renderfx: number;
  readonly solid: number;
  readonly sound?: number;
  readonly event?: number;

  // Rerelease fields
  readonly alpha?: number;
  readonly scale?: number;
  readonly instanceBits?: number;
  readonly loopVolume?: number;
  readonly loopAttenuation?: number;
  readonly owner?: number;
  readonly oldFrame?: number;
}
