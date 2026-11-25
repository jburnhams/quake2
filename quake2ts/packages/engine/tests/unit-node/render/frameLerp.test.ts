/**
 * Timing MD2 frame blends for a source that only knows the current frame: each change blends
 * from the frame before it over one 100 ms animation step, though the game runs at 40 Hz.
 */
import { describe, it, expect } from 'vitest';
import { ANIMATION_STEP_MS, FrameLerpTracker } from '../../../src/render/frameLerp.js';

describe('FrameLerpTracker', () => {
  it('draws a new entity at its frame, then blends each change over one animation step', () => {
    const lerp = new FrameLerpTracker();
    expect(lerp.sample(1, 5, 0, 0)).toEqual({ oldFrame: 0, frameLerp: 1 });
    expect(lerp.sample(1, 5, 0, 75)).toEqual({ oldFrame: 0, frameLerp: 1 });
    // The game steps the frame at 100 ms; frames in between blend toward it.
    expect(lerp.sample(1, 5, 1, 100)).toEqual({ oldFrame: 0, frameLerp: 0 });
    expect(lerp.sample(1, 5, 1, 125)).toEqual({ oldFrame: 0, frameLerp: 0.25 });
    expect(lerp.sample(1, 5, 1, 160)).toEqual({ oldFrame: 0, frameLerp: 0.6 });
    expect(lerp.sample(1, 5, 1, 100 + ANIMATION_STEP_MS)).toEqual({ oldFrame: 1, frameLerp: 1 });
    expect(lerp.sample(1, 5, 2, 200)).toEqual({ oldFrame: 1, frameLerp: 0 });
  });

  it('uses the step it is given, as ps.gunrate sets for the weapon', () => {
    const lerp = new FrameLerpTracker();
    lerp.sample(0, 7, 3, 0);
    expect(lerp.sample(0, 7, 4, 25, 50)).toEqual({ oldFrame: 3, frameLerp: 0 });
    expect(lerp.sample(0, 7, 4, 50, 50)).toEqual({ oldFrame: 3, frameLerp: 0.5 });
  });

  it('blends over a shorter interval when the frames change faster than the step, as a hasted weapon does', () => {
    const lerp = new FrameLerpTracker();
    lerp.sample(0, 7, 0, 0);
    lerp.sample(0, 7, 1, 50);
    expect(lerp.sample(0, 7, 2, 100)).toEqual({ oldFrame: 1, frameLerp: 0 });
    expect(lerp.sample(0, 7, 2, 125)).toEqual({ oldFrame: 1, frameLerp: 0.5 });
    expect(lerp.sample(0, 7, 2, 150)).toEqual({ oldFrame: 2, frameLerp: 1 });
  });

  it('does not blend across a model change, a freed slot or time going back', () => {
    const lerp = new FrameLerpTracker();
    lerp.sample(1, 5, 4, 0);
    expect(lerp.sample(1, 6, 0, 25)).toEqual({ oldFrame: 0, frameLerp: 1 }); // another weapon
    lerp.endFrame();
    lerp.endFrame(); // entity 1 not seen this frame: forgotten
    expect(lerp.sample(1, 6, 3, 50)).toEqual({ oldFrame: 3, frameLerp: 1 });
    lerp.sample(1, 6, 4, 75);
    expect(lerp.sample(1, 6, 5, 10)).toEqual({ oldFrame: 5, frameLerp: 1 }); // a new map restarts time
  });
});
