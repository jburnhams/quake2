import { mat4 } from 'gl-matrix';
import type { CameraState } from '../types/camera.js';
import type { CoordinateSystem } from '../types/coordinates.js';

export interface MatrixBuilder {
  buildViewMatrix(camera: CameraState): mat4;
  buildProjectionMatrix(camera: CameraState): mat4;
  readonly coordinateSystem: CoordinateSystem;
}

export interface ViewProjectionMatrices {
  readonly view: mat4;
  readonly projection: mat4;
  readonly viewProjection: mat4;
}

export function buildMatrices(
  builder: MatrixBuilder,
  camera: CameraState
): ViewProjectionMatrices {
  const view = builder.buildViewMatrix(camera);
  const projection = builder.buildProjectionMatrix(camera);
  const viewProjection = mat4.create();
  mat4.multiply(viewProjection, projection, view);

  return { view, projection, viewProjection };
}
