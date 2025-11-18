import { Vec3 } from './vec3.js';

export const PITCH = 0;
export const YAW = 1;
export const ROLL = 2;

const DEG2RAD_FACTOR = Math.PI / 180;
const RAD2DEG_FACTOR = 180 / Math.PI;

function axisComponent(vec: Vec3, axis: number): number {
  switch (axis) {
    case PITCH:
      return vec.x;
    case YAW:
      return vec.y;
    case ROLL:
    default:
      return vec.z;
  }
}

export interface AngleVectorsResult {
  readonly forward: Vec3;
  readonly right: Vec3;
  readonly up: Vec3;
}

export function degToRad(degrees: number): number {
  return degrees * DEG2RAD_FACTOR;
}

export function radToDeg(radians: number): number {
  return radians * RAD2DEG_FACTOR;
}

export function lerpAngle(from: number, to: number, frac: number): number {
  let target = to;

  if (target - from > 180) {
    target -= 360;
  } else if (target - from < -180) {
    target += 360;
  }

  return from + frac * (target - from);
}

export function angleMod(angle: number): number {
  const value = angle % 360;
  return value < 0 ? 360 + value : value;
}

export function angleVectors(angles: Vec3): AngleVectorsResult {
  const yaw = degToRad(axisComponent(angles, YAW));
  const pitch = degToRad(axisComponent(angles, PITCH));
  const roll = degToRad(axisComponent(angles, ROLL));

  const sy = Math.sin(yaw);
  const cy = Math.cos(yaw);
  const sp = Math.sin(pitch);
  const cp = Math.cos(pitch);
  const sr = Math.sin(roll);
  const cr = Math.cos(roll);

  const forward: Vec3 = {
    x: cp * cy,
    y: cp * sy,
    z: -sp,
  };

  const right: Vec3 = {
    x: -sr * sp * cy - cr * -sy,
    y: -sr * sp * sy - cr * cy,
    z: -sr * cp,
  };

  const up: Vec3 = {
    x: cr * sp * cy - sr * -sy,
    y: cr * sp * sy - sr * cy,
    z: cr * cp,
  };

  return { forward, right, up };
}

export function vectorToYaw(vec: Vec3): number {
  const pitch = axisComponent(vec, PITCH);
  const yawAxis = axisComponent(vec, YAW);

  if (pitch === 0) {
    if (yawAxis === 0) {
      return 0;
    }

    return yawAxis > 0 ? 90 : 270;
  }

  const yaw = radToDeg(Math.atan2(yawAxis, pitch));
  return yaw < 0 ? yaw + 360 : yaw;
}

export function vectorToAngles(vec: Vec3): Vec3 {
  const x = vec.x;
  const y = vec.y;
  const z = vec.z;

  if (y === 0 && x === 0) {
    return { x: z > 0 ? -90 : -270, y: 0, z: 0 };
  }

  let yaw: number;
  if (x) {
    yaw = radToDeg(Math.atan2(y, x));
  } else if (y > 0) {
    yaw = 90;
  } else {
    yaw = 270;
  }

  if (yaw < 0) {
    yaw += 360;
  }

  const forward = Math.sqrt(x * x + y * y);
  let pitch = radToDeg(Math.atan2(z, forward));
  if (pitch < 0) {
    pitch += 360;
  }

  return { x: -pitch, y: yaw, z: 0 };
}
