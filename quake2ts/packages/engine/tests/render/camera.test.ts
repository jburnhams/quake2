import { describe, it, expect } from 'vitest';
import { Camera } from '../../src/render/camera.js';
import { vec3, mat4 } from 'gl-matrix';
import { DEG2RAD } from '@quake2ts/shared';

describe('Camera', () => {
  it('should initialize with default values', () => {
    const camera = new Camera();
    expect(camera.position).toEqual(vec3.create());
    expect(camera.angles).toEqual(vec3.create());
    expect(camera.fov).toBe(90);
    expect(camera.aspect).toBe(1.0);
  });

  it('should update matrices when properties change', () => {
    const camera = new Camera();
    const initialViewMatrix = mat4.clone(camera.viewMatrix);
    const initialProjMatrix = mat4.clone(camera.projectionMatrix);

    camera.position = vec3.fromValues(10, 20, 30);
    camera.angles = vec3.fromValues(30, 45, 0);
    camera.fov = 75;

    expect(camera.viewMatrix).not.toEqual(initialViewMatrix);
    expect(camera.projectionMatrix).not.toEqual(initialProjMatrix);
  });

  it('should not update matrices if properties are unchanged', () => {
    const camera = new Camera();
    const initialViewMatrix = mat4.clone(camera.viewMatrix);
    const initialProjMatrix = mat4.clone(camera.projectionMatrix);

    // Access the matrices to clear the dirty flag
    camera.viewMatrix;
    camera.projectionMatrix;

    const newViewMatrix = mat4.clone(camera.viewMatrix);
    const newProjMatrix = mat4.clone(camera.projectionMatrix);

    expect(newViewMatrix).toEqual(initialViewMatrix);
    expect(newProjMatrix).toEqual(initialProjMatrix);
  });

  it('should calculate the viewmodel projection matrix correctly', () => {
    const camera = new Camera();
    camera.aspect = 16 / 9;
    const fov = 110;

    const expectedMatrix = mat4.create();
    mat4.perspective(expectedMatrix, fov * DEG2RAD, 16 / 9, 0.1, 1000);

    const actualMatrix = camera.getViewmodelProjectionMatrix(fov);

    expect(actualMatrix).toEqual(expectedMatrix);
  });

  it('should produce a valid view matrix at the origin', () => {
    const camera = new Camera();
    camera.position = vec3.fromValues(0, 0, 0);
    camera.angles = vec3.fromValues(0, 0, 0);

    // This is the expected transformation matrix from Quake's coordinate system
    // to WebGL's coordinate system, with no camera translation or rotation applied.
    const expectedMatrix = mat4.fromValues(
       0, -1,  0, 0,
       0,  0,  1, 0,
      -1,  0,  0, 0,
       0,  0,  0, 1
    );

    const actualMatrix = camera.viewMatrix;
    expect(actualMatrix).toEqual(expectedMatrix);
  });

  it('should produce a valid view matrix for a translated camera', () => {
    const camera = new Camera();
    // Move 10 units forward in Quake's coordinate system
    camera.position = vec3.fromValues(10, 0, 0);
    camera.angles = vec3.fromValues(0, 0, 0);

    // Manually calculated expected matrix. This combines the Quake-to-WebGL
    // coordinate system transform with a translation.
    const expectedMatrix = mat4.fromValues(
       0, -1,  0, 0,
       0,  0,  1, 0,
      -1,  0,  0, 0,
       0,  0, -10, 1
    );

    const actualMatrix = camera.viewMatrix;
    expect(actualMatrix).toEqual(expectedMatrix);
  });
});
