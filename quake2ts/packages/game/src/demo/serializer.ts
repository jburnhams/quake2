import {
  BinaryWriter,
  ServerCommand,
  EntityState,
  writeDeltaEntity,
  writePlayerState,
  ProtocolPlayerState
} from '@quake2ts/shared';
import { GameStateSnapshot } from '../index.js';

/**
 * Serializes a GameStateSnapshot into a sequence of network commands (ServerCommands)
 * suitable for recording to a demo file or sending over the network.
 *
 * @param snapshot The game state snapshot to serialize
 * @returns A Uint8Array containing the serialized commands
 */
export function serializeSnapshot(snapshot: GameStateSnapshot): Uint8Array {
  const writer = new BinaryWriter();

  // 1. Write svc_frame
  writer.writeByte(ServerCommand.frame);
  writer.writeLong(snapshot.level.frameNumber); // Sequence
  writer.writeLong(0); // Delta frame (0 = no delta, full update)
  writer.writeByte(0); // suppressCount
  writer.writeByte(0); // areaBytes

  // 2. Write svc_playerinfo
  writer.writeByte(ServerCommand.playerinfo);

  const ps: ProtocolPlayerState = {
    pm_type: snapshot.pm_type,
    origin: snapshot.origin,
    velocity: snapshot.velocity,
    pm_time: snapshot.pm_time,
    pm_flags: snapshot.pmFlags,
    gravity: snapshot.gravity.z,
    delta_angles: snapshot.deltaAngles,
    viewoffset: snapshot.client?.viewoffset || { x: 0, y: 0, z: 22 },
    viewangles: snapshot.viewangles,
    kick_angles: snapshot.kick_angles,
    gun_index: snapshot.gunindex,
    gun_frame: snapshot.gun_frame,
    gun_offset: snapshot.gunoffset,
    gun_angles: snapshot.gunangles,
    blend: snapshot.blend,
    fov: snapshot.fov,
    rdflags: snapshot.rdflags,
    stats: snapshot.stats,
    watertype: snapshot.watertype
  };

  writePlayerState(writer, ps);

  // 3. Write svc_packetentities
  writer.writeByte(ServerCommand.packetentities);

  for (const ent of snapshot.packetEntities) {
      // Force full update (no delta from previous frame)
      // newEntity=true uses NULL_STATE as baseline.
      writeDeltaEntity({} as EntityState, ent, writer, true, true);
  }

  // Terminate with 0 byte (implies number=0, bits=0)
  writer.writeByte(0);

  return writer.getData();
}
