import {
  ClientRenderer,
  EngineImports,
  GameFrameResult,
  GameRenderSample,
  createCamera,
  Camera,
} from '@quake2ts/engine';
import { UserCommand, Vec3 } from '@quake2ts/shared';
import { vec3, mat4 } from 'gl-matrix';
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
  camera?: Camera;
}

export function createClient(imports: ClientImports): ClientExports {
  const prediction = new ClientPrediction(imports.engine.trace);
  const view = new ViewEffects();
  let latestFrame: GameFrameResult<PredictionState> | undefined;
  let lastRendered: PredictionState | undefined;
  let lastView: ViewSample | undefined;
  let camera: Camera | undefined;

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
    render(sample: GameRenderSample<PredictionState>): UserCommand {
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

      if (lastRendered) {
        const { origin, viewangles } = lastRendered;
        const position = vec3.fromValues(origin.x, origin.y, origin.z);
        const rotation = mat4.create();
        mat4.rotateY(rotation, rotation, viewangles.y * (Math.PI / 180));
        mat4.rotateX(rotation, rotation, viewangles.x * (Math.PI / 180));
        const forward = vec3.transformMat4(vec3.create(), vec3.fromValues(1, 0, 0), rotation);
        const target = vec3.add(vec3.create(), position, forward);
        camera = createCamera(position, target, vec3.fromValues(0, 0, 1), 90, 4 / 3, 0.1, 1000);
      }

      const command = {} as UserCommand;

      void imports;
      void sample;

      return command;
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
    get camera(): Camera | undefined {
      return camera;
    }
  };
}
