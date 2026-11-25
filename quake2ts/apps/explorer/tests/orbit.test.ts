// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { describeOrbit, dragOrbit, frameRun, keyOrbit, orbitEye, zoomOrbit, type Orbit } from '../src/labs/movement/orbit';
import type { MovementFrame } from '../src/labs/movement/simulate';

// The lab's camera: framed on the run from its side, turned and zoomed by keys and drags.
const frame = (x: number, y: number, z: number): MovementFrame => ({ t: 0, distance: 0, height: 0, speed: 0, onGround: true, origin: { x, y, z } });

describe('the lab orbit', () => {
  it('frames a run along +x from its right side and above, looking at its middle', () => {
    const o = frameRun([frame(0, 0, 0), frame(400, 0, 40)]);
    expect(o.target).toEqual({ x: 200, y: 0, z: 20 });
    expect(o.yaw).toBe(90);
    expect(o.pitch).toBe(35);
    const eye = orbitEye(o);
    expect(eye.y).toBeLessThan(0); // right of the run (-y), looking towards +y
    expect(eye.z).toBeGreaterThan(o.target.z); // above it
    expect(Math.hypot(eye.x - 200, eye.y, eye.z - 20)).toBeCloseTo(o.distance, 6);
  });

  it('turns, tilts within ±89 and zooms within its limits', () => {
    const o: Orbit = { target: { x: 0, y: 0, z: 0 }, yaw: 0, pitch: 80, distance: 100 };
    expect(dragOrbit(o, 10, 100).pitch).toBe(89);
    expect(dragOrbit(o, 10, 0).yaw).toBe(-4);
    expect(zoomOrbit(o, 0.01).distance).toBe(64);
    expect(keyOrbit(o, 'ArrowLeft', o)!.yaw).toBe(10);
    expect(keyOrbit(o, '+', o)!.distance).toBe(80);
    const home = { ...o, yaw: 45 };
    expect(keyOrbit(o, '0', home)).toBe(home);
    expect(keyOrbit(o, 'a', home)).toBeNull();
  });

  it('says the view in words', () => {
    expect(describeOrbit({ target: { x: 0, y: 0, z: 0 }, yaw: -90, pitch: 20, distance: 600 })).toBe('Facing south, looking down 20°, 600 units from the middle of the run.');
  });
});
