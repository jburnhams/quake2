import { Vec3 } from '@quake2ts/shared';

export enum DemoCameraMode {
    FirstPerson,
    ThirdPerson,
    Free,
    Follow
}

export interface DemoCameraState {
    mode: DemoCameraMode;
    thirdPersonDistance: number;
    thirdPersonOffset: Vec3;
    freeCameraOrigin: Vec3;
    freeCameraAngles: Vec3;
    followEntityId: number;
    currentFollowOrigin?: Vec3;
}
