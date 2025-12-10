import { vec3 } from 'gl-matrix';
import { Camera } from './camera.js';
import { DEG2RAD, RAD2DEG } from '@quake2ts/shared';

// Use shared angleVectors if available, otherwise implement local helper
function angleVectors(angles: vec3, forward: vec3, right: vec3, up: vec3): void {
  const angle0 = angles[0] * DEG2RAD;
  const angle1 = angles[1] * DEG2RAD;
  const angle2 = angles[2] * DEG2RAD;

  const sp = Math.sin(angle0);
  const cp = Math.cos(angle0);
  const sy = Math.sin(angle1);
  const cy = Math.cos(angle1);
  const sr = Math.sin(angle2);
  const cr = Math.cos(angle2);

  if (forward) {
    forward[0] = cp * cy;
    forward[1] = cp * sy;
    forward[2] = -sp;
  }
  if (right) {
    right[0] = -1 * sr * sp * cy + -1 * cr * -sy;
    right[1] = -1 * sr * sp * sy + -1 * cr * cy;
    right[2] = -1 * sr * cp;
  }
  if (up) {
    up[0] = cr * sp * cy + -sr * -sy;
    up[1] = cr * sp * sy + -sr * cy;
    up[2] = cr * cp;
  }
}

export interface CameraInput {
  moveForward: boolean;
  moveBackward: boolean;
  moveLeft: boolean;
  moveRight: boolean;
  moveUp: boolean;
  moveDown: boolean;
  pitch: number; // Mouse delta Y
  yaw: number;   // Mouse delta X
}

export interface CameraControllerOptions {
  speed: number;
  sensitivity: number;
}

export class FreeCameraController {
  private camera: Camera;
  private options: CameraControllerOptions;

  constructor(camera: Camera, options: Partial<CameraControllerOptions> = {}) {
    this.camera = camera;
    this.options = {
      speed: 300,
      sensitivity: 0.1,
      ...options
    };
  }

  update(deltaTime: number, input: CameraInput): void {
    const angles = this.camera.angles;
    const position = this.camera.position;

    // Rotation
    angles[0] += input.pitch * this.options.sensitivity;
    angles[1] -= input.yaw * this.options.sensitivity; // Yaw is usually inverted for mouse? Or input is deltaX

    // Clamp pitch
    if (angles[0] > 89) angles[0] = 89;
    if (angles[0] < -89) angles[0] = -89;

    // Normalize yaw
    while (angles[1] < 0) angles[1] += 360;
    while (angles[1] >= 360) angles[1] -= 360;

    this.camera.angles = angles;

    // Movement
    const forward = vec3.create();
    const right = vec3.create();
    const up = vec3.create();

    // In Quake: Pitch, Yaw, Roll
    // We want movement relative to view
    angleVectors(angles, forward, right, up);

    const moveDir = vec3.create();
    const speed = this.options.speed * deltaTime;

    if (input.moveForward) vec3.scaleAndAdd(moveDir, moveDir, forward, 1);
    if (input.moveBackward) vec3.scaleAndAdd(moveDir, moveDir, forward, -1);

    // Check right vector direction
    if (input.moveRight) vec3.scaleAndAdd(moveDir, moveDir, right, 1);
    if (input.moveLeft) vec3.scaleAndAdd(moveDir, moveDir, right, -1);

    // Absolute Up/Down for Fly mode
    if (input.moveUp) vec3.add(moveDir, moveDir, [0, 0, 1]);
    if (input.moveDown) vec3.add(moveDir, moveDir, [0, 0, -1]);

    if (vec3.length(moveDir) > 0) {
        vec3.normalize(moveDir, moveDir);
        vec3.scaleAndAdd(position, position, moveDir, speed);
        this.camera.position = position;
    }
  }

  setSpeed(speed: number): void {
    this.options.speed = speed;
  }
}
