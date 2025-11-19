import type {
  ClientRenderer,
  EngineImports,
  GameFrameResult,
  GameRenderSample,
} from '@quake2ts/engine';
import type { UserCommand } from '@quake2ts/shared';
import { ClientPrediction, interpolatePredictionState } from './prediction.js';
import type { PredictionState } from './prediction.js';
import { ViewEffects, type ViewSample } from './view-effects.js';
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
export {
  ClientPrediction,
  defaultPredictionState,
  interpolatePredictionState,
  type PredictionSettings,
  type PredictionState,
} from './prediction.js';
export { ViewEffects, type ViewEffectSettings, type ViewKick, type ViewSample } from './view-effects.js';

export interface ClientImports {
  readonly engine: EngineImports;
}

export interface ClientExports extends ClientRenderer<PredictionState> {
  predict(command: UserCommand): PredictionState;
  readonly prediction: ClientPrediction;
  readonly lastRendered?: PredictionState;
  readonly view: ViewEffects;
  readonly lastView?: ViewSample;
}

export function createClient(imports: ClientImports): ClientExports {
  const prediction = new ClientPrediction();
  const view = new ViewEffects();
  let latestFrame: GameFrameResult<PredictionState> | undefined;
  let lastRendered: PredictionState | undefined;
  let lastView: ViewSample | undefined;

  return {
    init(initial) {
      latestFrame = initial;
      if (initial?.state) {
        prediction.setAuthoritative(initial);
      }
      void imports.engine.trace({ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 });
    },
    predict(command: UserCommand): PredictionState {
      return prediction.enqueueCommand(command);
    },
    render(sample: GameRenderSample<PredictionState>): void {
      if (sample.latest?.state) {
        prediction.setAuthoritative(sample.latest);
        latestFrame = sample.latest;
      }

      if (sample.previous?.state && sample.latest?.state) {
        lastRendered = interpolatePredictionState(sample.previous.state, sample.latest.state, sample.alpha);
      } else {
        lastRendered = sample.latest?.state ?? sample.previous?.state ?? prediction.getPredictedState();
      }

      const frameTimeMs = sample.latest && sample.previous ? Math.max(0, sample.latest.timeMs - sample.previous.timeMs) : 0;
      lastView = view.sample(lastRendered, frameTimeMs);

      void imports;
      void sample;
    },
    shutdown() {
      latestFrame = undefined;
      lastRendered = undefined;
    },
    get prediction(): ClientPrediction {
      return prediction;
    },
    get lastRendered(): PredictionState | undefined {
      return lastRendered;
    },
    get view(): ViewEffects {
      return view;
    },
    get lastView(): ViewSample | undefined {
      return lastView;
    },
  };
}
