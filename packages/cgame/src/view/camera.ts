import { Camera } from '@quake2ts/engine';
import { ViewSample } from './effects.js';
import { vec3 } from 'gl-matrix';
import { Vec3 } from '@quake2ts/shared';

const toGlMatrixVec3 = (v: Vec3): vec3 => {
    return vec3.fromValues(v.x, v.y, v.z);
};

export const updateCamera = (camera: Camera, viewSample: ViewSample) => {
    // Apply the view model effects to the camera
    camera.bobAngles = toGlMatrixVec3(viewSample.angles);
    camera.bobOffset = toGlMatrixVec3(viewSample.offset);
};
