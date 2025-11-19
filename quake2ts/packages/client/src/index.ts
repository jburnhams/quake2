import type {
  ClientRenderer,
  EngineImports,
  GameFrameResult,
  GameRenderSample,
} from '@quake2ts/engine';
import type { Vec3 } from '@quake2ts/shared';
export { createDefaultBindings, InputBindings, normalizeCommand, normalizeInputCode } from './input/bindings.js';
export {
  GamepadLike,
  GamepadLikeButton,
  InputAction,
  InputController,
  TouchInputState,
  type InputControllerOptions,
} from './input/controller.js';
export {
  InputCommandBuffer,
  type QueuedFrameCommands,
} from './input/command-buffer.js';

export interface ClientImports {
  readonly engine: EngineImports;
}

export interface PredictionState {
  readonly origin: Vec3;
  readonly velocity: Vec3;
}

export interface ClientExports extends ClientRenderer<PredictionState> {
  predict(next: PredictionState): PredictionState;
}

export function createClient(imports: ClientImports): ClientExports {
  let latestFrame: GameFrameResult<PredictionState> | undefined;

  return {
    init(initial) {
      latestFrame = initial;
      void imports.engine.trace({ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 });
    },
    predict(next: PredictionState): PredictionState {
      const { origin, velocity } = next;
      return {
        origin: {
          x: origin.x + velocity.x,
          y: origin.y + velocity.y,
          z: origin.z + velocity.z,
        },
        velocity,
      };
    },
    render(sample: GameRenderSample<PredictionState>): void {
      latestFrame = sample.latest ?? latestFrame;
      void sample;
    },
    shutdown() {
      latestFrame = undefined;
    },
  };
}
