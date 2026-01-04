import { mat4 } from 'gl-matrix';
import type { CameraState } from '../types/camera.js';
import { WebGLMatrixBuilder } from '../matrix/webgl.js';
import { buildMatrices } from '../matrix/builders.js';

/**
 * Adapter that converts CameraState to GL matrices.
 * Ensures WebGL renderer behavior remains identical during migration.
 */
export class WebGLCameraAdapter {
  private builder = new WebGLMatrixBuilder();

  /**
   * Build view and projection matrices from CameraState.
   * Output is IDENTICAL to current Camera.viewMatrix and Camera.projectionMatrix.
   */
  buildMatrices(cameraState: CameraState): {
    readonly view: mat4;
    readonly projection: mat4;
    readonly viewProjection: mat4;
  } {
    return buildMatrices(this.builder, cameraState);
  }

  /**
   * Build view matrix only.
   */
  buildViewMatrix(cameraState: CameraState): mat4 {
    return this.builder.buildViewMatrix(cameraState);
  }

  /**
   * Build projection matrix only.
   */
  buildProjectionMatrix(cameraState: CameraState): mat4 {
    return this.builder.buildProjectionMatrix(cameraState);
  }
}
