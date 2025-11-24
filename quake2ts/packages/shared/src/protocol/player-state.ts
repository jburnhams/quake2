
import { Vec3 } from '../math/vec3.js';
import { WaterLevel } from '../pmove/constants.js';

export interface DamageIndicator {
    direction: Vec3;
    strength: number;
}

// Client-side predicted state (higher level)
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
}

// Mutable Vec3 for internal use in Protocol parsing/writing
export interface MutableVec3 {
  x: number;
  y: number;
  z: number;
}

// Network Protocol Player State (as defined in Q2 protocol)
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
  blend: number[]; // [r,g,b,a]
  fov: number;
  rdflags: number;
  stats: number[]; // array of 32 shorts
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
  stats: new Array(32).fill(0)
});
