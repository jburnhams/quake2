import { BinaryWriter, PlayerState, MoveType } from '@quake2ts/shared';

export function writePlayerState(ps: PlayerState, writer: BinaryWriter) {
    // pmove_state_t
    writer.writeShort(ps.pmove.pm_type);
    writer.writeShort(ps.pmove.origin.x);
    writer.writeShort(ps.pmove.origin.y);
    writer.writeShort(ps.pmove.origin.z);
    writer.writeShort(ps.pmove.velocity.x);
    writer.writeShort(ps.pmove.velocity.y);
    writer.writeShort(ps.pmove.velocity.z);
    writer.writeByte(ps.pmove.pm_flags);
    writer.writeByte(ps.pmove.pm_time);
    writer.writeShort(ps.pmove.gravity);
    writer.writeShort(ps.pmove.delta_angles.x);
    writer.writeShort(ps.pmove.delta_angles.y);
    writer.writeShort(ps.pmove.delta_angles.z);

    // viewangles
    writer.writeAngle(ps.viewangles.x);
    writer.writeAngle(ps.viewangles.y);
    writer.writeAngle(ps.viewangles.z);

    // kick_angles
    writer.writeAngle(ps.kick_angles.x);
    writer.writeAngle(ps.kick_angles.y);
    writer.writeAngle(ps.kick_angles.z);

    // gunangles
    writer.writeAngle(ps.gunangles.x);
    writer.writeAngle(ps.gunangles.y);
    writer.writeAngle(ps.gunangles.z);

    // gunoffset
    writer.writeCoord(ps.gunoffset.x);
    writer.writeCoord(ps.gunoffset.y);
    writer.writeCoord(ps.gunoffset.z);

    // blend
    for (let i = 0; i < 4; i++) {
        writer.writeFloat(ps.blend[i]);
    }

    // fov
    writer.writeFloat(ps.fov);

    // rdflags
    writer.writeByte(ps.rdflags);

    // stats is an array of shorts in the original source
    for (let i = 0; i < ps.stats.length; i++) {
        writer.writeShort(ps.stats[i]);
    }
}
