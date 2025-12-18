import { EntityState, Vec3 } from '@quake2ts/shared';

/**
 * Interface representing a snapshot of the game state that can be recorded.
 * This mirrors GameStateSnapshot from @quake2ts/game but is defined here
 * to avoid circular dependencies.
 */
export interface RecorderSnapshot {
    readonly gravity: Vec3;
    readonly origin: Vec3;
    readonly velocity: Vec3;
    readonly viewangles: Vec3;
    readonly packetEntities: EntityState[];
    readonly pmFlags: number;
    readonly pmType: number;
    readonly pm_time: number;
    readonly deltaAngles: Vec3;
    readonly stats: number[];
    readonly kick_angles: Vec3;
    readonly gunoffset: Vec3;
    readonly gunangles: Vec3;
    readonly gunindex: number;
    readonly gun_frame: number;
    readonly rdflags: number;
    readonly fov: number;
    readonly blend: [number, number, number, number];
}
