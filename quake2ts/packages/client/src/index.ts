import {
  ClientRenderer,
  EngineImports,
  GameFrameResult,
  GameRenderSample,
  Camera,
  Renderer,
  DemoPlaybackController,
  PlaybackState,
  EngineHost,
} from '@quake2ts/engine';
import { UserCommand, Vec3, PlayerState, hasPmFlag, PmFlag, ConfigStringIndex, MAX_MODELS, MAX_SOUNDS, MAX_IMAGES } from '@quake2ts/shared';
import { vec3, mat4 } from 'gl-matrix';
import { ClientPrediction, interpolatePredictionState } from './prediction.js';
import type { PredictionState } from './prediction.js';
import { ViewEffects, type ViewSample } from './view-effects.js';
import { Draw_Hud, Init_Hud } from './hud.js';
import { Draw_Menu } from './ui/menu/render.js';
import { MessageSystem } from './hud/messages.js';
import { FrameRenderStats } from '@quake2ts/engine';
import { ClientNetworkHandler } from './demo/handler.js';
import { ClientConfigStrings } from './configStrings.js';
import { Cycle_Crosshair } from './hud/crosshair.js';
import { MainMenuFactory, MainMenuOptions } from './ui/menu/main.js';
import { SaveLoadMenuFactory } from './ui/menu/saveLoad.js';
import { MenuSystem } from './ui/menu/system.js';
import { SaveStorage } from '@quake2ts/game';
import { OptionsMenuFactory } from './ui/menu/options.js';
import { PauseMenuFactory } from './ui/menu/pause.js';
import { MapMenuFactory } from './ui/menu/maps.js';
import { InputController, InputControllerOptions } from './input/controller.js';

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
export { ClientConfigStrings } from './configStrings.js';

export interface ClientImports {
  readonly engine: EngineImports & { renderer: Renderer };
  readonly host?: EngineHost;
  readonly storage: SaveStorage; // Required for save/load menus
  readonly inputOptions?: InputControllerOptions;
}

export interface ClientExports extends ClientRenderer<PredictionState> {
  // Core Engine Hooks
  predict(command: UserCommand): PredictionState;
  ParseCenterPrint(msg: string): void;
  ParseNotify(msg: string): void;
  ParseConfigString(index: number, value: string): void;

  // State Access
  readonly prediction: ClientPrediction;
  readonly lastRendered?: PredictionState;
  readonly view: ViewEffects;
  readonly lastView?: ViewSample;
  readonly configStrings: ClientConfigStrings;
  camera?: Camera;

  // Demo Playback
  demoPlayback: DemoPlaybackController;
  demoHandler: ClientNetworkHandler;

  // Menu & Input
  readonly menuSystem: MenuSystem;
  readonly inputController: InputController;

  handleInput(code: string, down: boolean, key?: string): boolean;
  toggleMenu(): void;
  openMainMenu(): void;

  // cgame_export_t equivalents (if explicit names required)
  Init(initial?: GameFrameResult<PredictionState>): void;
  Shutdown(): void;
  DrawHUD(stats: FrameRenderStats, timeMs: number): void;
}

export function createClient(imports: ClientImports): ClientExports {
  const prediction = new ClientPrediction(imports.engine.trace);
  const view = new ViewEffects();
  const messageSystem = new MessageSystem();
  const demoPlayback = new DemoPlaybackController();
  const demoHandler = new ClientNetworkHandler(imports);

  // Input & Menu
  const inputController = new InputController(imports.inputOptions);
  const menuSystem = new MenuSystem();

  // Hook up message system to demo handler
  demoHandler.onCenterPrint = (msg: string) => messageSystem.addCenterPrint(msg, demoHandler.latestFrame?.serverFrame ?? 0); // Approx time
  demoHandler.onPrint = (level: number, msg: string) => messageSystem.addNotify(msg, demoHandler.latestFrame?.serverFrame ?? 0); // Approx time

  const configStrings = new ClientConfigStrings();

  demoPlayback.setHandler(demoHandler);

  let latestFrame: GameFrameResult<PredictionState> | undefined;
  let lastRendered: PredictionState | undefined;
  let lastView: ViewSample | undefined;
  let camera: Camera | undefined;

  // Default FOV
  let fovValue = 90;
  let isZooming = false;

  // Menu Factories
  let mainMenuFactory: MainMenuFactory;
  let pauseMenuFactory: PauseMenuFactory;
  let optionsFactory: OptionsMenuFactory;
  let saveLoadFactory: SaveLoadMenuFactory;
  let mapMenuFactory: MapMenuFactory;

  // Initialize Factories
  if (imports.host) {
      optionsFactory = new OptionsMenuFactory(menuSystem, imports.host);

      saveLoadFactory = new SaveLoadMenuFactory(
          menuSystem,
          imports.storage,
          async (name) => {
              // Save callback
              if (imports.host) {
                  imports.host.commands.execute(`save "${name}"`);
              }
          },
          async (slot) => {
             if (imports.host) {
                 imports.host.commands.execute(`load "${slot}"`);
             }
          },
          async (slot) => {
             await imports.storage.delete(slot);
          }
      );

      mainMenuFactory = new MainMenuFactory(menuSystem, saveLoadFactory, {
          onNewGame: () => {
              // Open Map Menu or start new game directly
              menuSystem.pushMenu(mapMenuFactory.createMapMenu());
          },
          onQuit: () => {
              // Browser can't really quit, maybe reload or show "Thanks for playing"
              window.location.reload();
          },
          optionsFactory,
          showSaveOption: false
      });

      pauseMenuFactory = new PauseMenuFactory(menuSystem, {
          onResume: () => {
              menuSystem.closeAll();
              inputController.setPointerLocked(true); // Re-lock
          },
          onRestart: () => {
              imports.host?.commands.execute('restart');
              menuSystem.closeAll();
          },
          onQuit: () => {
              imports.host?.commands.execute('disconnect');
              menuSystem.closeAll();
              menuSystem.pushMenu(mainMenuFactory.createMainMenu());
          },
          optionsFactory,
          saveLoadFactory // Pass factory to enable Save/Load in Pause Menu
      });

      mapMenuFactory = new MapMenuFactory(menuSystem, (map) => {
          imports.host?.commands.execute(`map ${map}`);
      });
  }

  // Register commands
  if (imports.host?.commands) {
    imports.host.commands.register('playdemo', (args) => {
      if (args.length < 1) {
        console.log('usage: playdemo <filename>');
        return;
      }
      const filename = args[0];
      console.log(`playdemo: ${filename}`);
      console.log('Note: Demo loading requires VFS access which is not yet fully integrated into this console command.');
      // TODO: Access VFS to load file content and call demoPlayback.loadDemo(buffer)
    }, 'Play a recorded demo');

    imports.host.commands.register('crosshair', () => {
        const index = Cycle_Crosshair();
        console.log(`Crosshair changed to index ${index}`);
    }, 'Cycle through available crosshairs');

    imports.host.commands.register('+zoom', () => {
        isZooming = true;
    }, 'Zoom in view');

    imports.host.commands.register('-zoom', () => {
        isZooming = false;
    }, 'Reset zoom');

    imports.host.commands.register('togglemenu', () => {
        clientExports.toggleMenu();
    }, 'Toggle main/pause menu');

    if (imports.host.cvars) {
      imports.host.cvars.register({
        name: 'fov',
        defaultValue: '90',
        flags: 0, // CvarFlags.None
        onChange: (cvar) => {
          const f = cvar.number; // Use helper getter
          if (!isNaN(f)) {
            fovValue = Math.max(1, Math.min(179, f));
          }
        },
        description: 'Field of view'
      });

      // Initialize fovValue from cvar
      const initialFov = imports.host.cvars.get('fov');
      if (initialFov) {
        const f = initialFov.number; // Use helper getter
         if (!isNaN(f)) {
          fovValue = Math.max(1, Math.min(179, f));
        }
      }
    }
  }

  const clientExports: ClientExports = {
    init(initial) {
      this.Init(initial);
    },

    Init(initial) {
      latestFrame = initial;
      if (initial?.state) {
        prediction.setAuthoritative(initial);
      }

      // Initialize HUD assets if asset manager is available
      if (imports.engine.assets && imports.engine.renderer) {
         Init_Hud(imports.engine.renderer, imports.engine.assets);
      }

      void imports.engine.trace({ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 });

      // Open main menu on startup if valid
      if (imports.host && mainMenuFactory) {
         // Maybe not auto-open if it's a reload?
         // For now, let's leave it closed or controlled by shell.
      }
    },

    predict(command: UserCommand): PredictionState {
      return prediction.enqueueCommand(command);
    },

    menuSystem,
    inputController,

    handleInput(code: string, down: boolean, key?: string): boolean {
        // If menu is active, consume all input (don't pass to game)
        if (menuSystem.isActive()) {
            if (down) {
                let action: 'up' | 'down' | 'left' | 'right' | 'select' | 'back' | 'char' | undefined;

                if (code === 'ArrowUp') action = 'up';
                else if (code === 'ArrowDown') action = 'down';
                else if (code === 'ArrowLeft') action = 'left';
                else if (code === 'ArrowRight') action = 'right';
                else if (code === 'Enter' || code === 'Space') action = 'select';
                else if (code === 'Escape') action = 'back';

                // If no specific action matched, and we have a char key, pass it
                if (!action && key && key.length === 1) {
                    action = 'char';
                } else if (!action && code === 'Backspace') {
                    action = 'left'; // Backspace maps to left/delete for input in simple implementation
                }

                // Also map WASD for navigation if not typing in input field?
                // Difficult to know if input field focused without peeking menu state details.
                // For now, prioritize char input if provided.
                // If we want WASD nav, we should check if current item is input.
                // MenuSystem knows. Let's try to map WASD to nav as fallback if not consumed as char?
                // But 'char' action is generic.

                // For now: Arrow keys = Nav. WASD = Char (if char provided).
                // If key is undefined (e.g. not provided by caller), we can't do char input easily.

                if (action) {
                    menuSystem.handleInput(action, key);
                }
            }
            return true;
        } else if (code === 'Escape' && down) {
            this.toggleMenu();
            return true;
        }

        // Pass to InputController
        if (down) {
            inputController.handleKeyDown(code);
        } else {
            inputController.handleKeyUp(code);
        }
        return false;
    },

    toggleMenu() {
        if (menuSystem.isActive()) {
            // Close menu
            menuSystem.closeAll();
            // Re-request pointer lock if needed
            inputController.setPointerLocked(true);
        } else {
            // Open menu
            // Determine which menu (Pause vs Main)
            // If in-game (connected), Pause Menu. Else Main Menu.
            // For now, assume Main Menu if not connected logic available, or Pause if running.
            // Simplified: Always Pause Menu if factories exist, let it handle "Quit to Main".
            if (pauseMenuFactory) {
                 inputController.reset(); // Clear any held keys so player doesn't get stuck moving
                 menuSystem.pushMenu(pauseMenuFactory.createPauseMenu());
                 inputController.setPointerLocked(false);
            }
        }
    },

    openMainMenu() {
        if (mainMenuFactory) {
            menuSystem.closeAll();
            inputController.reset();
            menuSystem.pushMenu(mainMenuFactory.createMainMenu());
            inputController.setPointerLocked(false);
        }
    },

    render(sample: GameRenderSample<PredictionState>): UserCommand {
      const playbackState = demoPlayback.getState();

      if (playbackState === PlaybackState.Playing) {
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

      const command = {} as UserCommand;

      if (lastRendered) {
        const { origin, viewangles } = lastRendered;
        camera = new Camera();
        camera.position = vec3.fromValues(origin.x, origin.y, origin.z);
        camera.angles = vec3.fromValues(viewangles.x, viewangles.y, viewangles.z);
        camera.fov = isZooming ? 40 : fovValue;
        camera.aspect = 4 / 3; // Should be updated by renderer aspect ratio
      }

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
        const timeMs = sample.latest?.timeMs ?? 0;

        // Call DrawHUD
        this.DrawHUD(stats, timeMs);
      }

      // Generate Command
      // If menu is active, return neutral command
      if (menuSystem.isActive()) {
          return {
              msec: Math.min(Math.max(Math.round(frameTimeMs), 1), 250),
              buttons: 0,
              angles: { x: 0, y: 0, z: 0 },
              forwardmove: 0,
              sidemove: 0,
              upmove: 0
          };
      }

      // Build command from InputController
      const serverFrame = sample.latest?.frame ?? 0;
      return inputController.buildCommand(frameTimeMs, performance.now(), serverFrame);
    },

    DrawHUD(stats: FrameRenderStats, timeMs: number) {
        if (!imports.engine.renderer || !lastRendered || !lastRendered.client) return;

        const playerState: PlayerState = {
            origin: lastRendered.origin,
            velocity: lastRendered.velocity,
            viewAngles: lastRendered.viewangles,
            onGround: hasPmFlag(lastRendered.pmFlags, PmFlag.OnGround),
            waterLevel: lastRendered.waterlevel,
            mins: { x: -16, y: -16, z: -24 },
            maxs: { x: 16, y: 16, z: 32 },
            damageAlpha: lastRendered.damageAlpha ?? 0,
            damageIndicators: lastRendered.damageIndicators ?? [],
            blend: lastRendered.blend ?? [0, 0, 0, 0],
            pickupIcon: lastRendered.pickupIcon
        };

        const playbackState = demoPlayback.getState();

        // Use demo time if playing, else game time
        const hudTimeMs = (playbackState === PlaybackState.Playing || playbackState === PlaybackState.Paused)
            ? (demoHandler.latestFrame?.serverFrame || 0) * 100 // Approximate
            : timeMs;

        Draw_Hud(
          imports.engine.renderer,
          playerState,
          lastRendered.client,
          lastRendered.health,
          lastRendered.armor,
          lastRendered.ammo,
          stats,
          messageSystem,
          hudTimeMs
        );

        // Draw Menu
        if (menuSystem.isActive()) {
            const { width, height } = imports.engine.renderer.getCanvasSize ? { width: imports.engine.renderer.getCanvasSize().width, height: imports.engine.renderer.getCanvasSize().height } : { width: 640, height: 480 };
            Draw_Menu(imports.engine.renderer, menuSystem.getState(), width, height);
        }
    },

    shutdown() {
      this.Shutdown();
    },

    Shutdown() {
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
      const timeMs = latestFrame?.timeMs ?? 0;
      messageSystem.addCenterPrint(msg, timeMs);
    },
    ParseNotify(msg: string) {
      const timeMs = latestFrame?.timeMs ?? 0;
      messageSystem.addNotify(msg, timeMs);
    },
    ParseConfigString(index: number, value: string) {
      configStrings.set(index, value);

      // Precache assets
      if (imports.engine.assets) {
          const assets = imports.engine.assets;

          if (index >= ConfigStringIndex.Models && index < ConfigStringIndex.Models + MAX_MODELS) {
              const ext = value.split('.').pop()?.toLowerCase();
              if (ext === 'md2') {
                  // We don't have texture dependencies easily available here without parsing more,
                  // or assuming a convention (like players). For now, just load geometry.
                  assets.loadMd2Model(value).catch(e => console.warn(`Failed to precache MD2 ${value}`, e));
              } else if (ext === 'sp2') {
                  assets.loadSprite(value).catch(e => console.warn(`Failed to precache Sprite ${value}`, e));
              } else if (ext === 'md3') {
                  assets.loadMd3Model(value).catch(e => console.warn(`Failed to precache MD3 ${value}`, e));
              }
              // Inline BSP models (begins with *) are handled by map loader usually.
          } else if (index >= ConfigStringIndex.Sounds && index < ConfigStringIndex.Sounds + MAX_SOUNDS) {
               assets.loadSound(value).catch(e => console.warn(`Failed to precache sound ${value}`, e));
          } else if (index >= ConfigStringIndex.Images && index < ConfigStringIndex.Images + MAX_IMAGES) {
               assets.loadTexture(value).then(texture => {
                   if (imports.engine.renderer) {
                       // Register the texture with the renderer so it's ready for Draw_Pic
                       imports.engine.renderer.registerTexture(value, texture);
                   }
               }).catch(e => console.warn(`Failed to precache image ${value}`, e));
          }
      }
    },
    demoHandler,
    configStrings
  };

  return clientExports;
}
