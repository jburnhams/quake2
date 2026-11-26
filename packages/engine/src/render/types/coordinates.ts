/**
 * Coordinate System Reference
 *
 * QUAKE (Game Engine):
 * - +X: Forward
 * - +Y: Left
 * - +Z: Up
 * - Right-handed
 * - Angles: [pitch, yaw, roll] in degrees
 *
 * OPENGL/WEBGL:
 * - +X: Right
 * - +Y: Up
 * - +Z: Back (toward camera)
 * - Right-handed
 * - NDC: [-1, 1] for X, Y, Z
 * - Depth: 1 (near) to -1 (far)
 *
 * WEBGPU:
 * - +X: Right
 * - +Y: Up
 * - +Z: Forward (away from camera)
 * - Left-handed (affected by projection matrix)
 * - NDC: [-1, 1] for X, Y; [0, 1] for Z
 * - Depth: 0 (near) to 1 (far)
 */

export enum CoordinateSystem {
  QUAKE = 'quake',
  OPENGL = 'opengl',
  WEBGPU = 'webgpu'
}

export interface CoordinateConvention {
  readonly system: CoordinateSystem;
  readonly handedness: 'left' | 'right';
  readonly forward: '+X' | '+Y' | '+Z' | '-X' | '-Y' | '-Z';
  readonly up: '+X' | '+Y' | '+Z' | '-X' | '-Y' | '-Z';
  readonly ndcDepthRange: [number, number]; // [near, far]
}
