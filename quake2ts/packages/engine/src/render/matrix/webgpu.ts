import { mat4, vec3 } from 'gl-matrix';
import { DEG2RAD } from '@quake2ts/shared';
import type { CameraState } from '../types/camera.js';
import type { MatrixBuilder } from './builders.js';
import { CoordinateSystem } from '../types/coordinates.js';

export class WebGPUMatrixBuilder implements MatrixBuilder {
  readonly coordinateSystem = CoordinateSystem.WEBGPU;

  buildProjectionMatrix(camera: CameraState): mat4 {
    // WebGPU uses [0, 1] depth range (not [-1, 1] like GL)
    const projection = mat4.create();

    const f = 1.0 / Math.tan((camera.fov * DEG2RAD) / 2);
    const rangeInv = 1.0 / (camera.near - camera.far);

    // Column-major WebGPU projection matrix
    // Standard perspective matrix for Z in [-far, -near] mapping to [0, 1]
    projection[0] = f / camera.aspect;
    projection[5] = f;
    projection[10] = camera.far * rangeInv;          // Z mapping to [0,1]
    projection[11] = -1;
    projection[14] = camera.near * camera.far * rangeInv;

    return projection;
  }

  buildViewMatrix(camera: CameraState): mat4 {
    // Build view matrix in WebGPU coordinate system
    // Standard WebGPU View Space (Left-Handed Clip Space, but typically View Space is Right-Handed looking down -Z)
    // The projection matrix above with projection[11] = -1 expects the camera to look down -Z.

    // Quake: +X Forward, +Y Left, +Z Up
    // Target: -Z Forward, +X Right, +Y Up

    const [pitch, yaw, roll] = camera.angles;

    // Convert Quake angles to WebGPU view direction
    // Yaw:
    // Quake Yaw 0 is +X (East).
    // Target Forward is -Z.
    // We need to rotate +X to -Z.
    // In a RH system (Y Up), +X to -Z is a +90 degree rotation around Y.
    // So if Yaw is 0, we want -Z.
    // Yaw increases counter-clockwise (Left).
    // So Yaw 90 is +Y (North). Target +Y corresponds to -X (Left in Target space).
    // Wait, Quake Y is Left. Target X is Right. So Quake Y maps to -Target X.

    // Let's re-verify rotation.
    // Quake Yaw = 0 -> Forward (+X). Target needs to be -Z.
    // Quake Yaw = 90 -> Left (+Y). Target needs to be -X.

    // Rotation Matrix R should transform World -> Camera.
    // Or we can think of rotating the Camera from Identity (looking -Z) to Look Direction.
    // Then View Matrix = Inverse(CameraRotation).

    // Let's construct the rotation from Quake Angles to View Space directly.
    // View Space Basis Vectors in Quake Coordinates:
    // View-Z (Backward) = -Forward (Quake X) = (-1, 0, 0)
    // View-X (Right)    = -Left (Quake Y)    = (0, -1, 0)
    // View-Y (Up)       = Up (Quake Z)       = (0, 0, 1)

    // So the Basis change matrix (World -> View) without rotation is:
    // Row 0 (X basis):  0, -1,  0  (Maps Q-Y to -V-X) -> No, dot product.
    // View Space X axis corresponds to Quake -Y axis (0, -1, 0).
    // View Space Y axis corresponds to Quake +Z axis (0, 0, 1).
    // View Space Z axis corresponds to Quake -X axis (-1, 0, 0).

    // M_basis =
    // [ 0 -1  0  0 ]
    // [ 0  0  1  0 ]
    // [-1  0  0  0 ]
    // [ 0  0  0  1 ]

    // Test: P_quake = (1, 0, 0) (Forward). M * P = (0, 0, -1). (Forward in View). Correct.
    // Test: P_quake = (0, 1, 0) (Left).    M * P = (-1, 0, 0). (Left in View? View X is Right, so -X is Left). Correct.
    // Test: P_quake = (0, 0, 1) (Up).      M * P = (0, 1, 0).  (Up in View). Correct.

    // Now consider rotation.
    // We rotate the world by -Yaw, -Pitch, -Roll.
    // Quake Rotation (Z-up):
    // R_z(-yaw) * R_y(-pitch) * R_x(-roll).

    const pitchRad = pitch * DEG2RAD;
    const yawRad = yaw * DEG2RAD;
    const rollRad = roll * DEG2RAD;

    const rotationQuake = mat4.create();
    mat4.identity(rotationQuake);
    mat4.rotateZ(rotationQuake, rotationQuake, -yawRad);
    mat4.rotateY(rotationQuake, rotationQuake, -pitchRad);
    mat4.rotateX(rotationQuake, rotationQuake, -rollRad);

    // Now apply Basis Change to the rotated world.
    const basisChange = mat4.fromValues(
       0,  0, -1, 0, // Column 0: Quake X maps to View Z? Wait.
      -1,  0,  0, 0, // Column 1: Quake Y maps to View X?
       0,  1,  0, 0, // Column 2: Quake Z maps to View Y?
       0,  0,  0, 1
    );
    // mat4.fromValues is Col-Major.
    // Col 0: (0, -1, 0) ? No, first arg is M00.
    // M =
    // [ 0 -1  0  0 ]
    // [ 0  0  1  0 ]
    // [-1  0  0  0 ]
    // [ 0  0  0  1 ]

    // Col 0: 0, 0, -1, 0.
    // Col 1: -1, 0, 0, 0.
    // Col 2: 0, 1, 0, 0.
    // Col 3: 0, 0, 0, 1.

    // Let's check logic:
    // P_view = M_basis * P_rotated_quake

    // P_rotated_quake = R_quake * (P_world - CameraPos)
    // Wait, typical view matrix construction:
    // View = R_view_inverse * T_view_inverse.
    // T_view_inverse translates world so camera is at origin. (T = -CameraPos).
    // R_view_inverse rotates world to align with camera axes.

    // Quake Rotation Logic (from Camera.ts):
    // 1. Translate by -Pos.
    // 2. Rotate by -Yaw, -Pitch, -Roll.
    // This gives coordinates in "Rotated Quake Space" (still X-forward relative to camera).

    // We want coordinates in "View Space" (-Z forward).
    // So we take "Rotated Quake Space" and apply basis change.
    // X_rotated (Forward) -> -Z_view
    // Y_rotated (Left)    -> -X_view (Right is +X)
    // Z_rotated (Up)      -> +Y_view

    // This mapping matches the Basis Change Matrix M_basis defined above.

    // Implementation:
    // 1. Build R_quake (inverse rotation).
    // 2. Build T_quake (inverse translation).
    // 3. Combine: M_quake_view = M_basis * R_quake * T_quake.

    // Note: The previous logic in WebGL builder did:
    // M_gl_view = M_coord_transform * R_quake * T_quake.
    // Where M_coord_transform was:
    // X -> -Z
    // Y -> -X
    // Z -> Y

    // This is EXACTLY the same basis change we derived for WebGPU!
    // Because WebGPU (standard perspective) also looks down -Z, Right is +X, Up is +Y.
    // The only difference between WebGL and WebGPU matrices is usually the Clip Space depth range ([0,1] vs [-1,1]), which is handled by Projection Matrix.
    // The View Matrix should be identical if the coordinate system conventions (Right Handed View Space) are the same.

    // So, we can reuse the exact same logic structure as WebGL but ensure clarity.

    const quakeToWgpu = mat4.fromValues(
       0,  0, -1, 0, // Col 0: X -> -Z
      -1,  0,  0, 0, // Col 1: Y -> -X
       0,  1,  0, 0, // Col 2: Z -> Y
       0,  0,  0, 1
    );

    // View = Basis * Rotation * Translation
    // We can multiply Basis * Rotation first.

    const rotationView = mat4.create();
    mat4.multiply(rotationView, quakeToWgpu, rotationQuake);

    // Now handle Translation.
    // T = -CameraPos.
    // P_view = RotationView * (P_world - CameraPos)
    //        = RotationView * P_world - RotationView * CameraPos.
    // So the translation column in the final matrix is -(RotationView * CameraPos).

    const cameraPos = vec3.fromValues(
        camera.position[0],
        camera.position[1],
        camera.position[2]
    );

    const t = vec3.transformMat4(vec3.create(), cameraPos, rotationView);
    vec3.negate(t, t);

    const view = mat4.clone(rotationView);
    view[12] = t[0];
    view[13] = t[1];
    view[14] = t[2];

    return view;
  }
}
