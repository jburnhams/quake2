import { BinaryWriter, Vec3 } from '@quake2ts/shared';

export interface ProtocolPlayerState {
  pm_type: number;
  origin: Vec3;
  velocity: Vec3;
  pm_time: number;
  pm_flags: number;
  gravity: number;
  delta_angles: Vec3;
  viewoffset: Vec3;
  viewangles: Vec3;
  kick_angles: Vec3;
  gun_index: number;
  gun_frame: number;
  gun_offset: Vec3;
  gun_angles: Vec3;
  blend: number[]; // [r,g,b,a]
  fov: number;
  rdflags: number;
  stats: number[];
}

// Bitflags matching demo/parser.ts
const PS_M_TYPE = (1 << 0);
const PS_M_ORIGIN = (1 << 1);
const PS_M_VELOCITY = (1 << 2);
const PS_M_TIME = (1 << 3);
const PS_M_FLAGS = (1 << 4);
const PS_M_GRAVITY = (1 << 5);
const PS_M_DELTA_ANGLES = (1 << 6);
const PS_VIEWOFFSET = (1 << 7);
const PS_VIEWANGLES = (1 << 8);
const PS_KICKANGLES = (1 << 9);
const PS_BLEND = (1 << 10);
const PS_FOV = (1 << 11);
const PS_WEAPONINDEX = (1 << 12);
const PS_WEAPONFRAME = (1 << 13);
const PS_RDFLAGS = (1 << 14);

export function writePlayerState(writer: BinaryWriter, ps: ProtocolPlayerState): void {
  // Determine mask
  let mask = 0;

  if (ps.pm_type !== 0) mask |= PS_M_TYPE;
  if (ps.origin.x !== 0 || ps.origin.y !== 0 || ps.origin.z !== 0) mask |= PS_M_ORIGIN;
  if (ps.velocity.x !== 0 || ps.velocity.y !== 0 || ps.velocity.z !== 0) mask |= PS_M_VELOCITY;
  if (ps.pm_time !== 0) mask |= PS_M_TIME;
  if (ps.pm_flags !== 0) mask |= PS_M_FLAGS;
  if (ps.gravity !== 0) mask |= PS_M_GRAVITY;
  if (ps.delta_angles.x !== 0 || ps.delta_angles.y !== 0 || ps.delta_angles.z !== 0) mask |= PS_M_DELTA_ANGLES;
  if (ps.viewoffset.x !== 0 || ps.viewoffset.y !== 0 || ps.viewoffset.z !== 0) mask |= PS_VIEWOFFSET;
  if (ps.viewangles.x !== 0 || ps.viewangles.y !== 0 || ps.viewangles.z !== 0) mask |= PS_VIEWANGLES;
  if (ps.kick_angles.x !== 0 || ps.kick_angles.y !== 0 || ps.kick_angles.z !== 0) mask |= PS_KICKANGLES;
  if (ps.gun_index !== 0) mask |= PS_WEAPONINDEX;

  // Weapon frame includes offset/angles
  if (ps.gun_frame !== 0 ||
      ps.gun_offset.x !== 0 || ps.gun_offset.y !== 0 || ps.gun_offset.z !== 0 ||
      ps.gun_angles.x !== 0 || ps.gun_angles.y !== 0 || ps.gun_angles.z !== 0) {
      mask |= PS_WEAPONFRAME;
  }

  if (ps.blend && (ps.blend[0] !== 0 || ps.blend[1] !== 0 || ps.blend[2] !== 0 || ps.blend[3] !== 0)) {
      mask |= PS_BLEND;
  }

  if (ps.fov !== 0) mask |= PS_FOV;
  if (ps.rdflags !== 0) mask |= PS_RDFLAGS;

  // Stats mask calculation
  let statsMask = 0;
  // Only support first 32 stats for now
  for (let i = 0; i < 32; i++) {
      if (ps.stats[i] && ps.stats[i] !== 0) {
          statsMask |= (1 << i);
      }
  }

  // Write header
  writer.writeShort(mask);

  // Write fields
  if (mask & PS_M_TYPE) writer.writeByte(ps.pm_type);

  if (mask & PS_M_ORIGIN) {
      writer.writeShort(Math.round(ps.origin.x * 8));
      writer.writeShort(Math.round(ps.origin.y * 8));
      writer.writeShort(Math.round(ps.origin.z * 8));
  }

  if (mask & PS_M_VELOCITY) {
      writer.writeShort(Math.round(ps.velocity.x * 8));
      writer.writeShort(Math.round(ps.velocity.y * 8));
      writer.writeShort(Math.round(ps.velocity.z * 8));
  }

  if (mask & PS_M_TIME) writer.writeByte(ps.pm_time);
  if (mask & PS_M_FLAGS) writer.writeByte(ps.pm_flags);
  if (mask & PS_M_GRAVITY) writer.writeShort(ps.gravity);

  if (mask & PS_M_DELTA_ANGLES) {
      writer.writeShort(Math.round(ps.delta_angles.x * (32768 / 180)));
      writer.writeShort(Math.round(ps.delta_angles.y * (32768 / 180)));
      writer.writeShort(Math.round(ps.delta_angles.z * (32768 / 180)));
  }

  if (mask & PS_VIEWOFFSET) {
      writer.writeChar(Math.round(ps.viewoffset.x * 4));
      writer.writeChar(Math.round(ps.viewoffset.y * 4));
      writer.writeChar(Math.round(ps.viewoffset.z * 4));
  }

  if (mask & PS_VIEWANGLES) {
      writer.writeAngle16(ps.viewangles.x);
      writer.writeAngle16(ps.viewangles.y);
      writer.writeAngle16(ps.viewangles.z);
  }

  if (mask & PS_KICKANGLES) {
      writer.writeChar(Math.round(ps.kick_angles.x * 4));
      writer.writeChar(Math.round(ps.kick_angles.y * 4));
      writer.writeChar(Math.round(ps.kick_angles.z * 4));
  }

  if (mask & PS_WEAPONINDEX) writer.writeByte(ps.gun_index);

  if (mask & PS_WEAPONFRAME) {
      writer.writeByte(ps.gun_frame);
      writer.writeChar(Math.round(ps.gun_offset.x * 4));
      writer.writeChar(Math.round(ps.gun_offset.y * 4));
      writer.writeChar(Math.round(ps.gun_offset.z * 4));
      writer.writeChar(Math.round(ps.gun_angles.x * 4));
      writer.writeChar(Math.round(ps.gun_angles.y * 4));
      writer.writeChar(Math.round(ps.gun_angles.z * 4));
  }

  if (mask & PS_BLEND) {
      writer.writeByte(Math.round(ps.blend[0]));
      writer.writeByte(Math.round(ps.blend[1]));
      writer.writeByte(Math.round(ps.blend[2]));
      writer.writeByte(Math.round(ps.blend[3]));
  }

  if (mask & PS_FOV) writer.writeByte(ps.fov);
  if (mask & PS_RDFLAGS) writer.writeByte(ps.rdflags);

  // Write Stats
  writer.writeLong(statsMask);
  for (let i = 0; i < 32; i++) {
      if (statsMask & (1 << i)) {
          writer.writeShort(ps.stats[i]);
      }
  }
}
