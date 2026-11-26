import { BinaryWriter, Vec3 } from '../index.js';

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
  watertype: number;

  // Optional / Extension fields if needed
  gunskin?: number;
  gunrate?: number;
  damage_blend?: number[];
  team_id?: number;
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
const PS_WATERTYPE = (1 << 15);

const zero: ProtocolPlayerState = {
  pm_type: 0, origin: { x: 0, y: 0, z: 0 }, velocity: { x: 0, y: 0, z: 0 }, pm_time: 0, pm_flags: 0, gravity: 0,
  delta_angles: { x: 0, y: 0, z: 0 }, viewoffset: { x: 0, y: 0, z: 0 }, viewangles: { x: 0, y: 0, z: 0 },
  kick_angles: { x: 0, y: 0, z: 0 }, gun_index: 0, gun_frame: 0, gun_offset: { x: 0, y: 0, z: 0 },
  gun_angles: { x: 0, y: 0, z: 0 }, blend: [0, 0, 0, 0], fov: 0, rdflags: 0, stats: [], watertype: 0,
};

// The pmove fields are shorts in the C's player_state_t, so it compares what goes on the wire.
const coord = (v: number) => Math.round(v * 8);
const angle = (v: number) => Math.round(v * (32768 / 180));
const sameShorts = (a: Vec3, b: Vec3, q: (v: number) => number) => q(a.x) === q(b.x) && q(a.y) === q(b.y) && q(a.z) === q(b.z);
const same = (a: Vec3, b: Vec3) => a.x === b.x && a.y === b.y && a.z === b.z;

/**
 * SV_WritePlayerstateToClient (server/sv_ents.c): the fields of `ps` that differ from `from`, the
 * player state of the frame the client acknowledged, or from zero when there is none (a whole
 * frame). The client starts from the same frame's state, so a field that is not sent keeps its
 * old value. Until 2026-11-26 this always wrote against zero, so a field that went back to 0 (a
 * stat cleared, the blend gone) never reached a client that deltaed.
 */
export function writePlayerState(writer: BinaryWriter, ps: ProtocolPlayerState, from: ProtocolPlayerState = zero): void {
  let mask = 0;

  if (ps.pm_type !== from.pm_type) mask |= PS_M_TYPE;
  if (!sameShorts(ps.origin, from.origin, coord)) mask |= PS_M_ORIGIN;
  if (!sameShorts(ps.velocity, from.velocity, coord)) mask |= PS_M_VELOCITY;
  if (ps.pm_time !== from.pm_time) mask |= PS_M_TIME;
  if (ps.pm_flags !== from.pm_flags) mask |= PS_M_FLAGS;
  if (ps.gravity !== from.gravity) mask |= PS_M_GRAVITY;
  if (!sameShorts(ps.delta_angles, from.delta_angles, angle)) mask |= PS_M_DELTA_ANGLES;
  if (!same(ps.viewoffset, from.viewoffset)) mask |= PS_VIEWOFFSET;
  if (!same(ps.viewangles, from.viewangles)) mask |= PS_VIEWANGLES;
  if (!same(ps.kick_angles, from.kick_angles)) mask |= PS_KICKANGLES;
  if (ps.gun_index !== from.gun_index) mask |= PS_WEAPONINDEX;

  // Weapon frame carries the gun's offset and angles with it.
  if (ps.gun_frame !== from.gun_frame || !same(ps.gun_offset, from.gun_offset) || !same(ps.gun_angles, from.gun_angles)) {
      mask |= PS_WEAPONFRAME;
  }

  const blend = ps.blend ?? zero.blend;
  const oldBlend = from.blend ?? zero.blend;
  if (blend[0] !== oldBlend[0] || blend[1] !== oldBlend[1] || blend[2] !== oldBlend[2] || blend[3] !== oldBlend[3]) {
      mask |= PS_BLEND;
  }

  if (ps.fov !== from.fov) mask |= PS_FOV;
  if (ps.rdflags !== from.rdflags) mask |= PS_RDFLAGS;
  // Not in the C (bit 15 is unused there); the port sends the water type with the frame.
  if ((ps.watertype ?? 0) !== (from.watertype ?? 0)) mask |= PS_WATERTYPE;

  let statsMask = 0;
  for (let i = 0; i < 32; i++) {
      if ((ps.stats[i] ?? 0) !== (from.stats[i] ?? 0)) statsMask |= (1 << i);
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
      writer.writeShort(angle(ps.delta_angles.x));
      writer.writeShort(angle(ps.delta_angles.y));
      writer.writeShort(angle(ps.delta_angles.z));
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
      writer.writeByte(Math.round(blend[0]));
      writer.writeByte(Math.round(blend[1]));
      writer.writeByte(Math.round(blend[2]));
      writer.writeByte(Math.round(blend[3]));
  }

  if (mask & PS_FOV) writer.writeByte(ps.fov);
  if (mask & PS_RDFLAGS) writer.writeByte(ps.rdflags);
  if (mask & PS_WATERTYPE) writer.writeByte(ps.watertype ?? 0);

  // Write Stats
  writer.writeLong(statsMask);
  for (let i = 0; i < 32; i++) {
      if (statsMask & (1 << i)) {
          writer.writeShort(ps.stats[i] ?? 0);
      }
  }
}
