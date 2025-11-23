import {
  ClientRenderer,
  EngineImports,
  GameFrameResult,
  GameRenderSample,
  Camera,
  Renderer,
  DemoPlaybackController,
  PlaybackState,
} from '@quake2ts/engine';
import { UserCommand, Vec3, PlayerState, hasPmFlag, PmFlag } from '@quake2ts/shared';
import { vec3, mat4 } from 'gl-matrix';
import { ClientPrediction, interpolatePredictionState } from './prediction.js';
import type { PredictionState } from './prediction.js';
import { ViewEffects, type ViewSample } from './view-effects.js';
import { Draw_Hud, Init_Hud } from './hud.js';
import { MessageSystem } from './hud/messages.js';
import { FrameRenderStats } from '@quake2ts/engine';
import { ClientNetworkHandler } from './demo/handler.js';

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
  readonly engine: EngineImports & { renderer: Renderer };
}

export interface ClientExports extends ClientRenderer<PredictionState> {
  predict(command: UserCommand): PredictionState;
  readonly prediction: ClientPrediction;
  readonly lastRendered?: PredictionState;
  readonly view: ViewEffects;
  readonly lastView?: ViewSample;
  camera?: Camera;
  demoPlayback: DemoPlaybackController;
  ParseCenterPrint(msg: string): void;
  ParseNotify(msg: string): void;
  demoHandler: ClientNetworkHandler;
}

export function createClient(imports: ClientImports): ClientExports {
  const prediction = new ClientPrediction(imports.engine.trace);
  const view = new ViewEffects();
  const messageSystem = new MessageSystem();
  const demoPlayback = new DemoPlaybackController();
  const demoHandler = new ClientNetworkHandler();

  demoPlayback.setHandler(demoHandler);

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
      const playbackState = demoPlayback.getState();

      if (playbackState === PlaybackState.Playing) {
          // If playing demo, use demo handler for state
          // Note: demoPlayback needs to be updated.
          // We assume the host loop calls this with 'nowMs' and 'accumulatorMs'.
          // We can deduce delta time from the sample.
          // Or we should rely on an explicit update.
          // For now, let's just use the handler's latest state directly without interpolation (simpler for first pass).

          lastRendered = demoHandler.getPredictionState();

      } else {
          if (sample.latest?.state) {
            prediction.setAuthoritative(sample.latest);
            latestFrame = sample.latest;
          }

          if (sample.previous?.state && sample.latest?.state) {
            lastRendered = interpolatePredictionState(sample.previous.state, sample.latest.state, sample.alpha);
          } else {
            lastRendered = sample.latest?.state ?? sample.previous?.state ?? prediction.getPredictedState();
          }
      }

      const frameTimeMs = sample.latest && sample.previous ? Math.max(0, sample.latest.timeMs - sample.previous.timeMs) : 0;
      lastView = view.sample(lastRendered, frameTimeMs);

      if (lastRendered) {
        const { origin, viewangles } = lastRendered;
        camera = new Camera();
        camera.position = vec3.fromValues(origin.x, origin.y, origin.z);
        camera.angles = vec3.fromValues(viewangles.x, viewangles.y, viewangles.z);
        camera.fov = 90;
        camera.aspect = 4 / 3;
      }

      const command = {} as UserCommand;

      if (imports.engine.renderer && lastRendered && lastRendered.client) {
        const stats: FrameRenderStats = {
          batches: 0,
          facesDrawn: 0,
          drawCalls: 0,
          skyDrawn: false,
          viewModelDrawn: false,
          fps: 0,
          vertexCount: 0,
        };

        const playerState: PlayerState = {
            origin: lastRendered.origin,
            velocity: lastRendered.velocity,
            viewAngles: lastRendered.viewangles,
            onGround: hasPmFlag(lastRendered.pmFlags, PmFlag.OnGround),
            waterLevel: lastRendered.waterlevel,
            mins: { x: -16, y: -16, z: -24 },
            maxs: { x: 16, y: 16, z: 32 },
            damageAlpha: 0,
            damageIndicators: [],
        };
        const timeMs = sample.latest?.timeMs ?? 0;
        Draw_Hud(
          imports.engine.renderer,
          playerState,
          lastRendered.client,
          lastRendered.health,
          lastRendered.armor,
          lastRendered.ammo,
          stats,
          messageSystem,
          timeMs
        );
      }

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
    },
    demoPlayback,
    ParseCenterPrint(msg: string) {
      // We need current game time here.
      // If called from networking parsing, we might not have 'now' easily without latestFrame.
      // Use latestFrame.timeMs if available.
      const timeMs = latestFrame?.timeMs ?? 0;
      messageSystem.addCenterPrint(msg, timeMs);
    },
    ParseNotify(msg: string) {
      const timeMs = latestFrame?.timeMs ?? 0;
      messageSystem.addNotify(msg, timeMs);
    },
    demoHandler
  };
}
