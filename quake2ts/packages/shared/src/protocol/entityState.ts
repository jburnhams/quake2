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

export const createEmptyEntityState = (): EntityState => ({
  number: 0,
  origin: { x: 0, y: 0, z: 0 },
  angles: { x: 0, y: 0, z: 0 },
  modelIndex: 0,
  frame: 0,
  skinNum: 0,
  effects: 0,
  renderfx: 0,
  solid: 0,
  sound: 0,
  event: 0,
  alpha: 0,
  scale: 0,
  instanceBits: 0,
  loopVolume: 0,
  loopAttenuation: 0,
  owner: 0,
  oldFrame: 0,
  modelIndex2: 0,
  modelIndex3: 0,
  modelIndex4: 0
});
