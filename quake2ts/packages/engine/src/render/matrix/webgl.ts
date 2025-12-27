import { mat4, vec3 } from 'gl-matrix';
import { DEG2RAD } from '@quake2ts/shared';
import type { CameraState } from '../types/camera.js';
import type { MatrixBuilder } from './builders.js';
import { CoordinateSystem } from '../types/coordinates.js';

export class WebGLMatrixBuilder implements MatrixBuilder {
  readonly coordinateSystem = CoordinateSystem.OPENGL;

  buildProjectionMatrix(camera: CameraState): mat4 {
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
    // Quake → WebGL coordinate transform matrix
    // Reference: current camera.ts:296-301
    const quakeToGl = mat4.fromValues(
       0,  0, -1, 0,  // Quake +X (forward) → GL -Z
      -1,  0,  0, 0,  // Quake +Y (left) → GL -X
       0,  1,  0, 0,  // Quake +Z (up) → GL +Y
       0,  0,  0, 1
    );

    // Build rotation matrix in Quake space
    const [pitch, yaw, roll] = camera.angles;
    const pitchRad = pitch * DEG2RAD;
    const yawRad = yaw * DEG2RAD;
    const rollRad = roll * DEG2RAD;

    const rotationQuake = mat4.create();
    mat4.identity(rotationQuake);
    mat4.rotateZ(rotationQuake, rotationQuake, -yawRad);
    mat4.rotateY(rotationQuake, rotationQuake, -pitchRad);
    mat4.rotateX(rotationQuake, rotationQuake, -rollRad);

    // Combine Quake rotation with coordinate transform
    const rotationGl = mat4.create();
    mat4.multiply(rotationGl, quakeToGl, rotationQuake);

    // Transform position to GL space
    // Based on Camera.updateMatrices logic:
    // 1. Negate position (to get camera relative vector)
    // 2. Rotate by Quake rotation
    // 3. Transform by coordinate system

    // Note: The logic in Camera.ts does this:
    // const negativePosition = vec3.negate(vec3.create(), positionWithOffset);
    // const rotatedPosQuake = vec3.create();
    // vec3.transformMat4(rotatedPosQuake, negativePosition, rotationQuake);
    //
    // Then manually maps rotatedPosQuake to GL coords:
    // const translationGl = vec3.fromValues(
    //    rotatedPosQuake[1] ? -rotatedPosQuake[1] : 0,  // Y in Quake -> -X in WebGL
    //    rotatedPosQuake[2] || 0,                       // Z in Quake -> Y in WebGL
    //    rotatedPosQuake[0] ? -rotatedPosQuake[0] : 0   // X in Quake -> -Z in WebGL
    // );

    const negativePosition = vec3.negate(vec3.create(), camera.position);
    const rotatedPosQuake = vec3.create();
    vec3.transformMat4(rotatedPosQuake, negativePosition, rotationQuake);

    const translationGl = vec3.fromValues(
       rotatedPosQuake[1] ? -rotatedPosQuake[1] : 0,  // Y → -X
       rotatedPosQuake[2] || 0,                        // Z → Y
       rotatedPosQuake[0] ? -rotatedPosQuake[0] : 0   // X → -Z
    );

    // Build final view matrix
    const view = mat4.clone(rotationGl);
    view[12] = translationGl[0];
    view[13] = translationGl[1];
    view[14] = translationGl[2];

    return view;
  }
}
