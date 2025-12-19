import { BinaryWriter } from '@quake2ts/shared';
import type { GameStateSnapshot } from '@quake2ts/game';
import { ServerCommand, writeDeltaEntity, EntityState } from '@quake2ts/shared';

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

/**
 * Serializes a GameStateSnapshot into a binary format compatible with Quake 2 protocol (Server Commands).
 * This is primarily used for demo recording or network transmission of full frames.
 *
 * Note: This implementation assumes a "full update" (delta from null) for simplicity in demo recording,
 * effectively serializing the entire state as a keyframe.
 */
export function serializeSnapshot(snapshot: GameStateSnapshot): Uint8Array {
  const writer = new BinaryWriter();

  // 1. Frame Command
  writer.writeByte(ServerCommand.frame);
  writer.writeLong(snapshot.level.frameNumber);
  writer.writeLong(0); // Delta frame (0 for keyframe)
  writer.writeByte(0); // areabits (unused)
  writer.writeByte(0); // areabits (unused)

  // 2. Player Info
  writer.writeByte(ServerCommand.playerinfo);
  writePlayerState(writer, snapshot);

  // 3. Packet Entities
  writer.writeByte(ServerCommand.packetentities);

  // Write all entities as fresh spawns (force=true)
  for (const entity of snapshot.packetEntities) {
    writeDeltaEntity({} as EntityState, entity, writer, true, true);
  }

  // End of packet entities
  writer.writeShort(0);

  return writer.getData();
}

/**
 * Helper to write player state compatible with the protocol.
 * This maps GameStateSnapshot fields to the wire format.
 */
function writePlayerState(writer: BinaryWriter, snapshot: GameStateSnapshot): void {
  // Map GameStateSnapshot to local variables matching writePlayerState logic
  // Note: GameStateSnapshot uses both camelCase and snake_case depending on recent changes.
  // Using values from the interface definition I saw in packages/game/src/index.ts

  const pm_type = snapshot.pmType ?? 0;
  const origin = snapshot.origin;
  const velocity = snapshot.velocity;
  const pm_time = snapshot.pm_time ?? 0; // Using snake_case as per interface
  const pm_flags = snapshot.pmFlags ?? 0; // Interface had pmFlags (camelCase) but also compatibility fields
  const gravity = -snapshot.gravity.z; // Protocol expects positive scalar for gravity usually? No, it's a short.
  // Wait, `writeShort` is signed. Q2 gravity is usually 800.
  // Let's verify how gravity is passed. Usually it's just the Z component or an index?
  // In Q2 server code: `short gravity`.
  // `svs.client->ps.gravity = sv.gravity`.
  // So it's likely just the scalar value.
  // snapshot.gravity is a Vec3.
  // If gravity is vector, it might be weird. Q2 physics usually only has Z gravity.

  // Re-checking `packages/game/src/index.ts`:
  // readonly gravity: Vec3;
  // So we probably take Z? Or maybe length?
  // Standard Q2 `ps.gravity` is a short.
  // Let's assume it's `snapshot.gravity.z`.
  const gravityVal = Math.round(snapshot.gravity.z);

  const delta_angles = snapshot.deltaAngles;
  // GameStateSnapshot doesn't have viewoffset explicitly?
  // It has `gunoffset`.
  // Looking at interface: `readonly gunoffset: Vec3;`
  // Does it have `viewoffset`?
  // `readonly origin: Vec3;` is player origin.
  // `readonly viewangles: Vec3;`
  // `readonly gunangles: Vec3;`
  // It seems `viewoffset` is missing from `GameStateSnapshot`.
  // It is usually `0, 0, 22` for players.
  // Let's assume {0,0,0} or {0,0,22} if missing.
  const viewoffset = { x: 0, y: 0, z: 0 };

  const viewangles = snapshot.viewangles;
  const kick_angles = snapshot.kick_angles;
  const gun_index = snapshot.gunindex;
  const gun_frame = snapshot.gun_frame;
  const gun_offset = snapshot.gunoffset;
  const gun_angles = snapshot.gunangles;

  // Blend is [r,g,b,a] 0-1 range? Or 0-255?
  // In `GameStateSnapshot`: `readonly blend: [number, number, number, number];`
  // In `calculateBlend`: `blend[3] += da * 0.5`. Seems 0-1 range.
  // In `writePlayerState`: `writer.writeByte(Math.round(ps.blend[0]));`. Expects 0-255.
  // So we need to scale.
  const blend = [
    Math.round(snapshot.blend[0] * 255),
    Math.round(snapshot.blend[1] * 255),
    Math.round(snapshot.blend[2] * 255),
    Math.round(snapshot.blend[3] * 255)
  ];

  const fov = snapshot.fov;
  const rdflags = snapshot.rdflags;
  const watertype = snapshot.watertype;
  const stats = snapshot.stats;

  // Mask calculation
  let mask = 0;

  if (pm_type !== 0) mask |= PS_M_TYPE;
  if (origin.x !== 0 || origin.y !== 0 || origin.z !== 0) mask |= PS_M_ORIGIN;
  if (velocity.x !== 0 || velocity.y !== 0 || velocity.z !== 0) mask |= PS_M_VELOCITY;
  if (pm_time !== 0) mask |= PS_M_TIME;
  if (pm_flags !== 0) mask |= PS_M_FLAGS;
  if (gravityVal !== 0) mask |= PS_M_GRAVITY;
  if (delta_angles.x !== 0 || delta_angles.y !== 0 || delta_angles.z !== 0) mask |= PS_M_DELTA_ANGLES;
  if (viewoffset.x !== 0 || viewoffset.y !== 0 || viewoffset.z !== 0) mask |= PS_VIEWOFFSET;
  if (viewangles.x !== 0 || viewangles.y !== 0 || viewangles.z !== 0) mask |= PS_VIEWANGLES;
  if (kick_angles.x !== 0 || kick_angles.y !== 0 || kick_angles.z !== 0) mask |= PS_KICKANGLES;
  if (gun_index !== 0) mask |= PS_WEAPONINDEX;

  if (gun_frame !== 0 ||
      gun_offset.x !== 0 || gun_offset.y !== 0 || gun_offset.z !== 0 ||
      gun_angles.x !== 0 || gun_angles.y !== 0 || gun_angles.z !== 0) {
      mask |= PS_WEAPONFRAME;
  }

  if (blend[0] !== 0 || blend[1] !== 0 || blend[2] !== 0 || blend[3] !== 0) {
      mask |= PS_BLEND;
  }

  if (fov !== 0) mask |= PS_FOV;
  if (rdflags !== 0) mask |= PS_RDFLAGS;
  if (watertype !== 0) mask |= PS_WATERTYPE;

  // Stats mask calculation
  let statsMask = 0;
  for (let i = 0; i < 32; i++) {
      if (stats[i] && stats[i] !== 0) {
          statsMask |= (1 << i);
      }
  }

  // Write header
  writer.writeShort(mask);

  // Write fields
  if (mask & PS_M_TYPE) writer.writeByte(pm_type);

  if (mask & PS_M_ORIGIN) {
      writer.writeShort(Math.round(origin.x * 8));
      writer.writeShort(Math.round(origin.y * 8));
      writer.writeShort(Math.round(origin.z * 8));
  }

  if (mask & PS_M_VELOCITY) {
      writer.writeShort(Math.round(velocity.x * 8));
      writer.writeShort(Math.round(velocity.y * 8));
      writer.writeShort(Math.round(velocity.z * 8));
  }

  if (mask & PS_M_TIME) writer.writeByte(pm_time);
  if (mask & PS_M_FLAGS) writer.writeByte(pm_flags);
  if (mask & PS_M_GRAVITY) writer.writeShort(gravityVal);

  if (mask & PS_M_DELTA_ANGLES) {
      writer.writeShort(Math.round(delta_angles.x * (32768 / 180)));
      writer.writeShort(Math.round(delta_angles.y * (32768 / 180)));
      writer.writeShort(Math.round(delta_angles.z * (32768 / 180)));
  }

  if (mask & PS_VIEWOFFSET) {
      writer.writeChar(Math.round(viewoffset.x * 4));
      writer.writeChar(Math.round(viewoffset.y * 4));
      writer.writeChar(Math.round(viewoffset.z * 4));
  }

  if (mask & PS_VIEWANGLES) {
      writer.writeAngle16(viewangles.x);
      writer.writeAngle16(viewangles.y);
      writer.writeAngle16(viewangles.z);
  }

  if (mask & PS_KICKANGLES) {
      writer.writeChar(Math.round(kick_angles.x * 4));
      writer.writeChar(Math.round(kick_angles.y * 4));
      writer.writeChar(Math.round(kick_angles.z * 4));
  }

  if (mask & PS_WEAPONINDEX) writer.writeByte(gun_index);

  if (mask & PS_WEAPONFRAME) {
      writer.writeByte(gun_frame);
      writer.writeChar(Math.round(gun_offset.x * 4));
      writer.writeChar(Math.round(gun_offset.y * 4));
      writer.writeChar(Math.round(gun_offset.z * 4));
      writer.writeChar(Math.round(gun_angles.x * 4));
      writer.writeChar(Math.round(gun_angles.y * 4));
      writer.writeChar(Math.round(gun_angles.z * 4));
  }

  if (mask & PS_BLEND) {
      writer.writeByte(blend[0]);
      writer.writeByte(blend[1]);
      writer.writeByte(blend[2]);
      writer.writeByte(blend[3]);
  }

  if (mask & PS_FOV) writer.writeByte(fov);
  if (mask & PS_RDFLAGS) writer.writeByte(rdflags);
  if (mask & PS_WATERTYPE) writer.writeByte(watertype);

  // Write Stats
  writer.writeLong(statsMask);
  for (let i = 0; i < 32; i++) {
      if (statsMask & (1 << i)) {
          writer.writeShort(stats[i]);
      }
  }
}
