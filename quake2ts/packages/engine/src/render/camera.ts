import { mat4, vec3 } from 'gl-matrix';
import { DEG2RAD } from '@quake2ts/shared';

export class Camera {
  private _position: vec3 = vec3.create();
  private _angles: vec3 = vec3.create(); // pitch, yaw, roll
  private _bobAngles: vec3 = vec3.create();
  private _bobOffset: vec3 = vec3.create();
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

  get bobOffset(): vec3 {
    return this._bobOffset;
  }

  set bobOffset(value: vec3) {
    vec3.copy(this._bobOffset, value);
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

  screenToWorldRay(
    screenX: number,
    screenY: number
  ): { origin: vec3; direction: vec3 } {
    // 1. Calculate Normalized Device Coordinates (NDC)
    // screenX, screenY are in [0, 1] range
    // NDC: [-1, 1]
    const ndcX = (screenX * 2) - 1;
    const ndcY = 1 - (screenY * 2); // Flip Y because screen Y is down, NDC Y is up

    // 2. Create ray in clip space
    // Z = -1 for near plane, Z = 1 for far plane
    const clipStart = vec3.fromValues(ndcX, ndcY, -1);
    const clipEnd = vec3.fromValues(ndcX, ndcY, 1);

    // 3. Inverse View-Projection Matrix
    const invViewProj = mat4.create();
    mat4.invert(invViewProj, this.viewProjectionMatrix);

    // 4. Transform to World Space
    const worldStart = vec3.create();
    const worldEnd = vec3.create();

    vec3.transformMat4(worldStart, clipStart, invViewProj);
    vec3.transformMat4(worldEnd, clipEnd, invViewProj);

    // 5. Construct Ray
    // The start point is the camera position (or near plane intersection)
    // But for picking, we usually want the ray from the camera origin.
    // However, unprojecting ndcX, ndcY, -1 gives point on near plane.

    // Direction is normalized vector from start to end
    const direction = vec3.create();
    vec3.subtract(direction, worldEnd, worldStart);
    vec3.normalize(direction, direction);

    // The previous test expectation was failing because of coordinate space confusion.
    // If the test expects +X forward, and we get -0, 0, 0, it means the ray is pointing somewhere else.
    // Let's debug the coordinate transform.
    // Quake X (Forward) -> GL -Z.
    // NDC (0, 0, -1) -> Near Plane Center.
    // Inverse ViewProj should map NDC (0,0,-1) to World Position + Forward * NearDist.

    // If we are at 0,0,0 looking +X.
    // Quake +X is GL -Z.
    // So forward in GL is -Z.
    // NDC 0,0 is center.
    // Unprojecting should give direction -Z in GL space.
    // But we are transforming back to World Space (Quake space).
    // So GL -Z should map back to Quake +X.

    return {
      origin: vec3.clone(this._position),
      direction,
    };
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
    // - Quake X (forward) -> WebGL -Z  <-- FIXED from -Y to -Z
    // - Quake Y (left) -> WebGL -X     <-- FIXED from +Z to -X
    // - Quake Z (up) -> WebGL +Y       <-- FIXED from -X to +Y
    //
    // Let's re-verify the standard mapping.
    // Quake: X Forward, Y Left, Z Up.
    // GL: -Z Forward, X Right, Y Up.
    //
    // So:
    // Quake X (Forward) -> GL -Z
    // Quake Y (Left) -> GL -X  (Since GL X is Right, Left is -X)
    // Quake Z (Up) -> GL Y

    const quakeToGl = mat4.fromValues(
       0,  0, -1, 0,  // column 0: Quake X -> WebGL -Z
      -1,  0,  0, 0,  // column 1: Quake Y -> WebGL -X
       0,  1,  0, 0,  // column 2: Quake Z -> WebGL Y
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
    const positionWithOffset = vec3.add(vec3.create(), this._position, this._bobOffset);
    const negativePosition = vec3.negate(vec3.create(), positionWithOffset);
    const rotatedPosQuake = vec3.create();
    vec3.transformMat4(rotatedPosQuake, negativePosition, rotationQuake);

    // Transform the rotated position from Quake coordinates to WebGL coordinates
    // using the simple coordinate swizzle (not matrix multiplication)
    const translationGl = vec3.fromValues(
       rotatedPosQuake[1] ? -rotatedPosQuake[1] : 0,  // Y in Quake -> -X in WebGL
       rotatedPosQuake[2] || 0,  // Z in Quake -> Y in WebGL
       rotatedPosQuake[0] ? -rotatedPosQuake[0] : 0   // X in Quake -> -Z in WebGL
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
