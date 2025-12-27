import { mat4 } from 'gl-matrix';
import { DEG2RAD } from '@quake2ts/shared';
import type { CameraState } from '../types/camera.js';
import type { MatrixBuilder } from './builders.js';
import { CoordinateSystem } from '../types/coordinates.js';

export class IdentityMatrixBuilder implements MatrixBuilder {
  readonly coordinateSystem = CoordinateSystem.QUAKE;

  buildProjectionMatrix(camera: CameraState): mat4 {
    // Simple perspective, no coordinate transform
    const projection = mat4.create();
    mat4.perspective(
      projection,
      camera.fov * DEG2RAD,
      camera.aspect,
      camera.near,
      camera.far
    );
    return projection;
  }

  buildViewMatrix(camera: CameraState): mat4 {
    // Rotation and translation in Quake space (no transform)
    const [pitch, yaw, roll] = camera.angles;
    const pitchRad = pitch * DEG2RAD;
    const yawRad = yaw * DEG2RAD;
    const rollRad = roll * DEG2RAD;

    const rotation = mat4.create();
    mat4.identity(rotation);
    mat4.rotateZ(rotation, rotation, yawRad);
    mat4.rotateX(rotation, rotation, pitchRad);
    mat4.rotateY(rotation, rotation, rollRad);

    const translation = mat4.create();
    mat4.fromTranslation(translation, [
      -camera.position[0],
      -camera.position[1],
      -camera.position[2]
    ]);

    const view = mat4.create();
    mat4.multiply(view, rotation, translation);
    return view;
  }
}
