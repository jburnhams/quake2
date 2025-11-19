import { describe, expect, it } from 'vitest';
import { advanceAnimation, computeFrameBlend, createAnimationState, interpolateVec3 } from '../src/assets/animation.js';

describe('Model animation helpers', () => {
  it('advances looping animations and clamps non-looping sequences', () => {
    const looping = createAnimationState({ name: 'run', start: 0, end: 9, fps: 10, loop: true });
    const advanced = advanceAnimation(looping, 1.2);
    expect(advanced.time).toBeCloseTo(0.2);

    const once = createAnimationState({ name: 'pain', start: 0, end: 4, fps: 5, loop: false });
    const finished = advanceAnimation(once, 2);
    expect(finished.time).toBeCloseTo(1);
  });

  it('computes frame blends that match rerelease interpolation rules', () => {
    const state = createAnimationState({ name: 'attack', start: 5, end: 6, fps: 10 });
    const advanced = advanceAnimation(state, 0.075);
    const blend = computeFrameBlend(advanced);
    expect(blend.frame).toBe(5);
    expect(blend.nextFrame).toBe(6);
    expect(blend.lerp).toBeCloseTo(0.75);
  });

  it('holds the final frame for non-looping sequences', () => {
    const once = createAnimationState({ name: 'pain', start: 2, end: 4, fps: 10, loop: false });
    const nearingEnd = advanceAnimation(once, 0.25);
    const nearingBlend = computeFrameBlend(nearingEnd);
    expect(nearingBlend.frame).toBe(4);
    expect(nearingBlend.nextFrame).toBe(4);
    expect(nearingBlend.lerp).toBe(0);

    const finished = advanceAnimation(once, 0.5);
    const finishedBlend = computeFrameBlend(finished);
    expect(finishedBlend.frame).toBe(4);
    expect(finishedBlend.nextFrame).toBe(4);
    expect(finishedBlend.lerp).toBe(0);
  });

  it('interpolates vectors for keyframe blending', () => {
    const a = { x: 0, y: 0, z: 0 };
    const b = { x: 2, y: -2, z: 4 };
    expect(interpolateVec3(a, b, 0.5)).toEqual({ x: 1, y: -1, z: 2 });
  });
});
