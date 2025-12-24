
import { Vec3 } from '@quake2ts/shared';

export interface MutableVec3 {
  x: number;
  y: number;
  z: number;
}

export interface EntityState {
  number: number;
  modelindex: number;
  modelindex2: number;
  modelindex3: number;
  modelindex4: number;
  frame: number;
  skinnum: number;
  effects: number;
  renderfx: number;
  origin: MutableVec3;
  old_origin: MutableVec3;
  angles: MutableVec3;
  sound: number;
  event: number;
  solid: number;
  bits: number;
  bitsHigh: number;
  alpha: number;
  scale: number;
  instanceBits: number;
  loopVolume: number;
  loopAttenuation: number;
  owner: number;
  oldFrame: number;
}

export const createEmptyEntityState = (): EntityState => ({
  number: 0,
  modelindex: 0,
  modelindex2: 0,
  modelindex3: 0,
  modelindex4: 0,
  frame: 0,
  skinnum: 0,
  effects: 0,
  renderfx: 0,
  origin: { x: 0, y: 0, z: 0 },
  old_origin: { x: 0, y: 0, z: 0 },
  angles: { x: 0, y: 0, z: 0 },
  sound: 0,
  event: 0,
  solid: 0,
  bits: 0,
  bitsHigh: 0,
  alpha: 0,
  scale: 0,
  instanceBits: 0,
  loopVolume: 0,
  loopAttenuation: 0,
  owner: 0,
  oldFrame: 0
});

export interface ProtocolPlayerState {
  pm_type: number;
  origin: MutableVec3;
  velocity: MutableVec3;
  pm_time: number;
  pm_flags: number;
  gravity: number;
  delta_angles: MutableVec3;
  viewoffset: MutableVec3;
  viewangles: MutableVec3;
  kick_angles: MutableVec3;
  gun_index: number;
  gun_frame: number;
  gun_offset: MutableVec3;
  gun_angles: MutableVec3;
  blend: number[];
  fov: number;
  rdflags: number;
  stats: number[];
  gunskin: number;
  gunrate: number;
  damage_blend: number[];
  team_id: number;
  watertype: number;
}

export const createEmptyProtocolPlayerState = (): ProtocolPlayerState => ({
  pm_type: 0,
  origin: { x: 0, y: 0, z: 0 },
  velocity: { x: 0, y: 0, z: 0 },
  pm_time: 0,
  pm_flags: 0,
  gravity: 0,
  delta_angles: { x: 0, y: 0, z: 0 },
  viewoffset: { x: 0, y: 0, z: 0 },
  viewangles: { x: 0, y: 0, z: 0 },
  kick_angles: { x: 0, y: 0, z: 0 },
  gun_index: 0,
  gun_frame: 0,
  gun_offset: { x: 0, y: 0, z: 0 },
  gun_angles: { x: 0, y: 0, z: 0 },
  blend: [0, 0, 0, 0],
  fov: 0,
  rdflags: 0,
  stats: new Array(32).fill(0),
  gunskin: 0,
  gunrate: 0,
  damage_blend: [0, 0, 0, 0],
  team_id: 0,
  watertype: 0
});

export interface FrameData {
    serverFrame: number;
    deltaFrame: number;
    surpressCount: number;
    areaBytes: number;
    areaBits: Uint8Array;
    playerState: ProtocolPlayerState;
    packetEntities: {
        delta: boolean;
        entities: EntityState[];
    };
}

export interface FogData {
    density?: number;
    skyfactor?: number;
    red?: number;
    green?: number;
    blue?: number;
    time?: number;
    hf_falloff?: number;
    hf_density?: number;
    hf_start_r?: number;
    hf_start_g?: number;
    hf_start_b?: number;
    hf_start_dist?: number;
    hf_end_r?: number;
    hf_end_g?: number;
    hf_end_b?: number;
    hf_end_dist?: number;
}

export interface DamageIndicator {
    damage: number;
    health: boolean;
    armor: boolean;
    power: boolean;
    dir: Vec3;
}
