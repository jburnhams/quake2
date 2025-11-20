
import { mat4, vec3 } from 'gl-matrix';

export interface Camera {
  readonly position: vec3;
  readonly viewMatrix: mat4;
  readonly projectionMatrix: mat4;
}

export const createCamera = (
  position: vec3,
  target: vec3,
  up: vec3,
  fov: number,
  aspect: number,
  near: number,
  far: number
): Camera => {
  const viewMatrix = mat4.create();
  mat4.lookAt(viewMatrix, position, target, up);

  const projectionMatrix = mat4.create();
  mat4.perspective(projectionMatrix, fov, aspect, near, far);

  return {
    position,
    viewMatrix,
    projectionMatrix,
  };
};
