import { vec3 } from 'gl-matrix';

// Coordinate System Definitions:
// Quake:  X Forward, Y Left,  Z Up
// WebGL:  X Right,   Y Up,    Z Backward (Right-handed View Space)
// WebGPU: X Right,   Y Up,    Z Backward (Right-handed View Space, typically)

export function quakeToWebGL(v: vec3): vec3 {
  // Transformation:
  // Quake X (Forward) -> WebGL -Z (Forward)
  // Quake Y (Left)    -> WebGL -X (Right is +X)
  // Quake Z (Up)      -> WebGL +Y (Up)
  return vec3.fromValues(-v[1], v[2], -v[0]);
}

export function quakeToWebGPU(v: vec3): vec3 {
  // WebGPU typically uses the same View Space convention as WebGL (RH, -Z forward),
  // differing only in Clip Space depth range [0, 1] vs [-1, 1].
  // Thus, the coordinate transformation for points is identical.
  return vec3.fromValues(-v[1], v[2], -v[0]);
}

export function webGLToQuake(v: vec3): vec3 {
  // Inverse of quakeToWebGL:
  // GL X = -Quake Y  => Quake Y = -GL X
  // GL Y =  Quake Z  => Quake Z =  GL Y
  // GL Z = -Quake X  => Quake X = -GL Z
  return vec3.fromValues(-v[2], -v[0], v[1]);
}

export function webGPUToQuake(v: vec3): vec3 {
  // Inverse of quakeToWebGPU (same as webGLToQuake)
  return vec3.fromValues(-v[2], -v[0], v[1]);
}

export function debugCoordinate(label: string, quakeCoord: vec3): void {
  console.log(`${label}:`);
  console.log(`  Quake:  [${quakeCoord[0]}, ${quakeCoord[1]}, ${quakeCoord[2]}]`);
  console.log(`  WebGL:  [${quakeToWebGL(quakeCoord)}]`);
  console.log(`  WebGPU: [${quakeToWebGPU(quakeCoord)}]`);
}
