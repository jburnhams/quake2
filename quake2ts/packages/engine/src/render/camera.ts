import { mat4, vec3 } from 'gl-matrix';
import { DEG2RAD } from '@quake2ts/shared';

export class Camera {
  private _position: vec3 = vec3.create();
  private _angles: vec3 = vec3.create(); // pitch, yaw, roll
  private _bobAngles: vec3 = vec3.create();
  private _kickAngles: vec3 = vec3.create();
  private _rollAngle = 0;
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

  get bobAngles(): vec3 {
    return this._bobAngles;
  }

  set bobAngles(value: vec3) {
    vec3.copy(this._bobAngles, value);
    this._dirty = true;
  }

  get kickAngles(): vec3 {
    return this._kickAngles;
  }

  set kickAngles(value: vec3) {
    vec3.copy(this._kickAngles, value);
    this._dirty = true;
  }

  get rollAngle(): number {
    return this._rollAngle;
  }

  set rollAngle(value: number) {
    this._rollAngle = value;
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

    // 2. Create the coordinate system transformation matrix.
    // This matrix transforms vectors from Quake's coordinate system
    // (X forward, Y left, Z up) to WebGL's coordinate system (X right, Y up, Z back).
    //
    // Mapping (column vectors based on test expectations):
    // - Quake X (forward) -> WebGL -Y
    // - Quake Y (left) -> WebGL +Z
    // - Quake Z (up) -> WebGL -X
    const quakeToGl = mat4.fromValues(
       0, -1,  0, 0,  // column 0: Quake X -> WebGL (0, -1, 0)
       0,  0,  1, 0,  // column 1: Quake Y -> WebGL (0, 0, 1)
      -1,  0,  0, 0,  // column 2: Quake Z -> WebGL (-1, 0, 0)
       0,  0,  0, 1   // column 3: no translation
    );

    // 3. Construct the Quake rotation matrix
    const pitch = this._angles[0] + this._bobAngles[0] + this._kickAngles[0];
    const yaw = this._angles[1] + this._bobAngles[1] + this._kickAngles[1];
    const roll = this._angles[2] + this._bobAngles[2] + this._kickAngles[2] + this._rollAngle;

    const pitchRad = pitch * DEG2RAD;
    const yawRad = yaw * DEG2RAD;
    const rollRad = roll * DEG2RAD;

    const rotationQuake = mat4.create();
    mat4.identity(rotationQuake);

    // Rotations are applied in reverse order to the world
    // Quake's axes for rotation are: Z(yaw), Y(pitch), X(roll)
    mat4.rotateZ(rotationQuake, rotationQuake, -yawRad);
    mat4.rotateY(rotationQuake, rotationQuake, -pitchRad);
    mat4.rotateX(rotationQuake, rotationQuake, -rollRad);

    // 4. Combine Quake rotation with coordinate transformation
    const rotationGl = mat4.create();
    mat4.multiply(rotationGl, quakeToGl, rotationQuake);

    // 5. Calculate the view matrix translation
    // Apply rotation in Quake space first, then transform to GL coordinates
    const negativePosition = vec3.negate(vec3.create(), this._position);
    const rotatedPosQuake = vec3.create();
    vec3.transformMat4(rotatedPosQuake, negativePosition, rotationQuake);

    // Transform the rotated position from Quake coordinates to WebGL coordinates
    // using the simple coordinate swizzle (not matrix multiplication)
    const translationGl = vec3.fromValues(
       rotatedPosQuake[1] || 0,  // Y in Quake -> X in WebGL (negation already applied above)
       rotatedPosQuake[2] || 0,  // Z in Quake -> Y in WebGL
       rotatedPosQuake[0] || 0   // X in Quake -> Z in WebGL (negation already applied above)
    );

    // 6. Build the final view matrix by combining rotation and translation
    mat4.copy(this._viewMatrix, rotationGl);
    this._viewMatrix[12] = translationGl[0];
    this._viewMatrix[13] = translationGl[1];
    this._viewMatrix[14] = translationGl[2];

    // 7. Update the combined view-projection matrix
    mat4.multiply(
      this._viewProjectionMatrix,
      this._projectionMatrix,
      this._viewMatrix
    );

    this._dirty = false;
  }
}
