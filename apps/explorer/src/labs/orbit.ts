// The labs' 3D camera: an orbit around a target, in Quake's axes (x forward, y left,
// z up; positive pitch looks down), framed on what a lab draws so all of it is in view.
// Pure, so the framing and the controls are tested without WebGL. strata-react#370
// (SceneViewport) is meant to take the input side over; until then LabScene maps keys and drags
// to these functions itself.
export type Vec = { readonly x: number; readonly y: number; readonly z: number };

export interface Orbit {
  readonly target: Vec;
  /** Degrees; the direction the camera looks, as a Quake yaw. */
  readonly yaw: number;
  /** Degrees; positive looks down. Kept inside ±89 so the view never flips. */
  readonly pitch: number;
  /** Units from the target. */
  readonly distance: number;
}

const RAD = Math.PI / 180;
const MIN_DISTANCE = 64;
const MAX_DISTANCE = 8192;

/** Where the camera is for an orbit. */
export function orbitEye(o: Orbit): Vec {
  const cp = Math.cos(o.pitch * RAD);
  const forward = { x: cp * Math.cos(o.yaw * RAD), y: cp * Math.sin(o.yaw * RAD), z: -Math.sin(o.pitch * RAD) };
  return { x: o.target.x - forward.x * o.distance, y: o.target.y - forward.y * o.distance, z: o.target.z - forward.z * o.distance };
}

/**
 * A view of a path from its right side and above (the path runs from its first point to its
 * last), so a jump shows as an arc. Where a level has no room on that side, clipEye pulls the
 * camera in and the arrow keys turn it round.
 */
export function framePoints(points: readonly Vec[]): Orbit {
  if (points.length === 0) return { target: { x: 0, y: 0, z: 0 }, yaw: 0, pitch: 20, distance: 512 };
  const min = { x: Math.min(...points.map((p) => p.x)), y: Math.min(...points.map((p) => p.y)), z: Math.min(...points.map((p) => p.z)) };
  const max = { x: Math.max(...points.map((p) => p.x)), y: Math.max(...points.map((p) => p.y)), z: Math.max(...points.map((p) => p.z)) };
  const target = { x: (min.x + max.x) / 2, y: (min.y + max.y) / 2, z: (min.z + max.z) / 2 };
  const first = points[0]!;
  const last = points.at(-1)!;
  const heading = Math.atan2(last.y - first.y, last.x - first.x) / RAD;
  const extent = Math.max(max.x - min.x, max.y - min.y, max.z - min.z);
  return { target, yaw: heading + 90, pitch: 35, distance: clampDistance(extent * 0.9 + 160) };
}

const clampDistance = (d: number) => Math.min(MAX_DISTANCE, Math.max(MIN_DISTANCE, d));
const clampPitch = (p: number) => Math.min(89, Math.max(-89, p));

/** Turns the orbit by a drag of (dx, dy) pixels: across turns around, down looks further down. */
export function dragOrbit(o: Orbit, dx: number, dy: number): Orbit {
  return { ...o, yaw: o.yaw - dx * 0.4, pitch: clampPitch(o.pitch + dy * 0.4) };
}

/** Moves in (factor below 1) or out (above 1). */
export function zoomOrbit(o: Orbit, factor: number): Orbit {
  return { ...o, distance: clampDistance(o.distance * factor) };
}

/** The orbit after a key, or null for a key the view does not use. `home` is what 0 returns to. */
export function keyOrbit(o: Orbit, key: string, home: Orbit): Orbit | null {
  switch (key) {
    case 'ArrowLeft':
      return { ...o, yaw: o.yaw + 10 };
    case 'ArrowRight':
      return { ...o, yaw: o.yaw - 10 };
    case 'ArrowUp':
      return { ...o, pitch: clampPitch(o.pitch + 5) };
    case 'ArrowDown':
      return { ...o, pitch: clampPitch(o.pitch - 5) };
    case '+':
    case '=':
      return zoomOrbit(o, 0.8);
    case '-':
    case '_':
      return zoomOrbit(o, 1.25);
    case '0':
    case 'Home':
      return home;
    default:
      return null;
  }
}

/** The view in words, for the canvas's description; `standing` for a camera at the target looking out. */
export function describeOrbit(o: Orbit, standing = false): string {
  const compass = ['east', 'north-east', 'north', 'north-west', 'west', 'south-west', 'south', 'south-east'];
  const facing = compass[Math.round((((o.yaw % 360) + 360) % 360) / 45) % 8];
  const tilt = o.pitch > 5 ? `looking down ${Math.round(o.pitch)}°` : o.pitch < -5 ? `looking up ${Math.round(-o.pitch)}°` : 'level';
  if (standing) return `Facing ${facing}, ${tilt}.`;
  return `Facing ${facing}, ${tilt}, ${Math.round(o.distance)} units from the middle of what is drawn.`;
}

/**
 * Pulls the camera in towards the target until it is inside the level, as a third-person camera
 * does: the renderer draws what the camera's cluster can see, so an eye in a wall or in the void
 * outside the map sees nothing. `trace` sweeps from the target to the eye and returns how far it
 * got (0 to 1); the eye stops short of whatever it hit.
 */
export function clipEye(target: Vec, eye: Vec, trace: (from: Vec, to: Vec) => number): Vec {
  const fraction = Math.max(0, trace(target, eye) - 0.02);
  return { x: target.x + (eye.x - target.x) * fraction, y: target.y + (eye.y - target.y) * fraction, z: target.z + (eye.z - target.z) * fraction };
}
