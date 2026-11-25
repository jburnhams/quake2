export interface FrameBlend {
  readonly frame0: number;
  readonly frame1: number;
  readonly lerp: number;
}

export interface AnimationSequence {
  readonly name: string;
  readonly start: number;
  readonly end: number;
  readonly fps: number;
  readonly loop?: boolean;
}

export interface AnimationState {
  readonly sequence: AnimationSequence;
  readonly time: number;
}

export function advanceAnimation(state: AnimationState, deltaSeconds: number): AnimationState {
  const duration = (state.sequence.end - state.sequence.start + 1) / state.sequence.fps;
  const loop = state.sequence.loop !== false;
  let time = state.time + deltaSeconds;

  if (loop) {
    time = ((time % duration) + duration) % duration;
  } else if (time > duration) {
    time = duration;
  }

  return { ...state, time: Math.max(0, Math.min(time, duration)) };
}

export function computeFrameBlend(state: AnimationState): FrameBlend {
  const totalFrames = state.sequence.end - state.sequence.start + 1;
  const frameDuration = 1 / state.sequence.fps;
  const loop = state.sequence.loop !== false;
  const framePosition = state.time / frameDuration;

  if (!loop && framePosition >= totalFrames) {
    return { frame0: state.sequence.end, frame1: state.sequence.end, lerp: 0 };
  }

  const normalizedPosition = loop ? framePosition % totalFrames : Math.min(framePosition, totalFrames - 1);
  const baseFrame = Math.floor(normalizedPosition);
  const frame0 = state.sequence.start + baseFrame;
  const frame1 = baseFrame + 1 >= totalFrames ? (loop ? state.sequence.start : state.sequence.end) : frame0 + 1;
  const lerp = !loop && baseFrame >= totalFrames - 1 ? 0 : normalizedPosition - baseFrame;
  return { frame0, frame1, lerp };
}

export function createAnimationState(sequence: AnimationSequence): AnimationState {
  return { sequence, time: 0 };
}

export function interpolateVec3(
  a: { x: number; y: number; z: number },
  b: { x: number; y: number; z: number },
  t: number,
): { x: number; y: number; z: number } {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    z: a.z + (b.z - a.z) * t,
  };
}
