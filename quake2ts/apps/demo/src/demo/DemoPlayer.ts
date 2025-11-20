import { Camera } from '@quake2ts/engine';
import { PlayerState, Pmove, PmoveTrace, Vec3 } from '@quake2ts/shared';

export class DemoPlayer {
    readonly state: PlayerState;

    constructor(private readonly trace: PmoveTrace) {
        this.state = {
            // Initialize with default player state
            pm_type: 0,
            origin: [0, 0, 0],
            velocity: [0, 0, 0],
            pm_flags: 0,
            pm_time: 0,
            gravity: 800,
            delta_angles: [0, 0, 0],
        };
    }

    spawn(spawnPoint: { origin: number[], angle: number }) {
        this.state.origin = [spawnPoint.origin[0], spawnPoint.origin[1], spawnPoint.origin[2]];
    }

    move(camera: Camera, forward: number, right: number, up: number, dt: number) {
        const pmove = new Pmove(this.trace);

        const cmd = {
            forwardmove: forward * 400,
            sidemove: right * 400,
            upmove: up * 400,
        };

        const angles: Vec3 = { x: camera.pitch, y: camera.yaw, z: camera.roll };

        pmove.move(this.state, {
            ...cmd,
            msec: dt * 1000,
            angles: [angles.x, angles.y, angles.z]
        });

        camera.position.x = this.state.origin[0];
        camera.position.y = this.state.origin[1];
        camera.position.z = this.state.origin[2];
    }
}
