import { mat4, vec3 } from 'gl-matrix';
import { DEG2RAD } from '@quake2ts/shared';

export class Camera {
  private _position: vec3 = vec3.create();
  private _angles: vec3 = vec3.create(); // pitch, yaw, roll
  private _fov = 90;
  private _aspect = 1.0;
  private _near = 0.1;
  private _far = 1000;

  private _viewMatrix: mat4 = mat4.create();
  private _projectionMatrix: mat4 = mat4.create();
  private _viewProjectionMatrix: mat4 = mat4.create();
  private _dirty = true;

  get position(): vec3 {
    return this._position;
  }

  set position(value: vec3) {
    vec3.copy(this._position, value);
    this._dirty = true;
  }

  get angles(): vec3 {
    return this._angles;
  }

  set angles(value: vec3) {
    vec3.copy(this._angles, value);
    this._dirty = true;
  }

  get fov(): number {
    return this._fov;
  }

  set fov(value: number) {
    this._fov = value;
    this._dirty = true;
  }

  get aspect(): number {
    return this._aspect;
  }

  set aspect(value: number) {
    this._aspect = value;
    this._dirty = true;
  }

  get viewMatrix(): mat4 {
    this.updateMatrices();
    return this._viewMatrix;
  }

  get projectionMatrix(): mat4 {
    this.updateMatrices();
    return this._projectionMatrix;
  }

  get viewProjectionMatrix(): mat4 {
    this.updateMatrices();
    return this._viewProjectionMatrix;
  }

  getViewmodelProjectionMatrix(fov: number): mat4 {
    const projectionMatrix = mat4.create();
    mat4.perspective(
      projectionMatrix,
      fov * DEG2RAD,
      this._aspect,
      this._near,
      this._far
    );
    return projectionMatrix;
  }

  private updateMatrices(): void {
    if (!this._dirty) {
      return;
    }

    // 1. Update projection matrix
    mat4.perspective(
      this._projectionMatrix,
      this._fov * DEG2RAD,
      this._aspect,
      this._near,
      this._far
    );

    // 2. Construct the Quake view matrix
    const pitchRad = this._angles[0] * DEG2RAD;
    const yawRad = this._angles[1] * DEG2RAD;
    const rollRad = this._angles[2] * DEG2RAD;

    const viewQuake = mat4.create();
    mat4.identity(viewQuake);

    // Rotations are applied in reverse order to the world
    // Quake's axes for rotation are: Z(yaw), Y(pitch), X(roll)
    mat4.rotateZ(viewQuake, viewQuake, -yawRad);
    mat4.rotateY(viewQuake, viewQuake, -pitchRad);
    mat4.rotateX(viewQuake, viewQuake, -rollRad);

    // Translation is applied to the world
    const negativePosition = vec3.negate(vec3.create(), this._position);
    mat4.translate(viewQuake, viewQuake, negativePosition);

    // 3. Create the coordinate system transformation matrix.
    // This matrix transforms a view matrix from Quake's coordinate system
    // (X forward, Y left, Z up) to WebGL's coordinate system (X right, Y up, Z back).
    const quakeToGl = mat4.fromValues(
       0,  0, -1, 0,
       1,  0,  0, 0,
       0,  1,  0, 0,
       0,  0,  0, 1
    );

    // 4. Combine the matrices to get the final view matrix for WebGL
    mat4.multiply(this._viewMatrix, quakeToGl, viewQuake);

    // 5. Update the combined view-projection matrix
    mat4.multiply(
      this._viewProjectionMatrix,
      this._projectionMatrix,
      this._viewMatrix
    );

    this._dirty = false;
  }
}
