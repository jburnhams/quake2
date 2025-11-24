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
import { UserCommand, Vec3, PlayerState, hasPmFlag, PmFlag, ConfigStringIndex, MAX_MODELS, MAX_SOUNDS, MAX_IMAGES, CvarFlags } from '@quake2ts/shared';
import { vec3, mat4 } from 'gl-matrix';
import { ClientPrediction, interpolatePredictionState } from './prediction.js';
import type { PredictionState } from './prediction.js';
import { ViewEffects, type ViewSample } from './view-effects.js';
import { Draw_Hud, Init_Hud } from './hud.js';
import { MessageSystem } from './hud/messages.js';
import { FrameRenderStats } from '@quake2ts/engine';
import { ClientNetworkHandler } from './demo/handler.js';
import { ClientConfigStrings } from './configStrings.js';
import { Cycle_Crosshair } from './hud/crosshair.js';
import { MainMenuFactory, MainMenuOptions } from './ui/menu/main.js';
import { SaveLoadMenuFactory } from './ui/menu/saveLoad.js';
import { MenuSystem } from './ui/menu/system.js';
import { SaveStorage, PlayerClient } from '@quake2ts/game';
import { OptionsMenuFactory } from './ui/menu/options.js';
import { MapsMenuFactory } from './ui/menu/maps.js';
import { PauseMenuFactory } from './ui/menu/pause.js';
import { Draw_Menu } from './ui/menu/render.js';
import { InputBindings } from './input/bindings.js';
import { BrowserSettings, LocalStorageSettings } from './ui/storage.js';
import { LoadingScreen } from './ui/loading/screen.js';
import { ErrorDialog } from './ui/error.js';
import { WheelMenuSystem } from './ui/wheels/index.js';

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

  // Menu System
  createMainMenu(options: Omit<MainMenuOptions, 'optionsFactory' | 'mapsFactory' | 'onSetDifficulty'>, storage: SaveStorage, saveCallback: (name: string) => Promise<void>, loadCallback: (slot: string) => Promise<void>, deleteCallback: (slot: string) => Promise<void>): { menuSystem: MenuSystem, factory: MainMenuFactory };

  // Input handling
  handleInput(key: string, down: boolean): boolean;
  toggleMenu(): void;

  // cgame_export_t equivalents (if explicit names required)
  Init(initial?: GameFrameResult<PredictionState>): void;
  Shutdown(): void;
  DrawHUD(stats: FrameRenderStats, timeMs: number): void;

  // New UI components
  readonly loadingScreen: LoadingScreen;
  readonly errorDialog: ErrorDialog;
}

export function createClient(imports: ClientImports): ClientExports {
  const prediction = new ClientPrediction(imports.engine.trace);
  const view = new ViewEffects();
  const messageSystem = new MessageSystem();
  const demoPlayback = new DemoPlaybackController();
  const demoHandler = new ClientNetworkHandler(imports);

  // Initialize persistent Menu System
  const menuSystem = new MenuSystem();

  // Initialize UI components
  const loadingScreen = new LoadingScreen();
  const errorDialog = new ErrorDialog();
  const wheelMenuSystem = new WheelMenuSystem();
  const settings = new BrowserSettings(new LocalStorageSettings());

  // Menu Factories
  let pauseMenuFactory: PauseMenuFactory | undefined;
  let optionsFactory: OptionsMenuFactory | undefined;

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

  // Initialize Menu Factories
  if (imports.host) {
    optionsFactory = new OptionsMenuFactory(menuSystem, imports.host);
    pauseMenuFactory = new PauseMenuFactory(menuSystem, optionsFactory, imports.host);

    // Load Settings
    const cvarsMap = new Map<string, { value: string, setValue: (v: string) => void }>();
    if (imports.host.cvars) {
        for (const cvar of imports.host.cvars.list()) {
            cvarsMap.set(cvar.name, {
                value: cvar.string,
                setValue: (v) => imports.host!.cvars.setValue(cvar.name, v)
            });
        }
        settings.loadCvars(cvarsMap);
    }
  }

  if (imports.host?.commands) {
    imports.host.commands.register('playdemo', (args) => {
      if (args.length < 1) {
        console.log('usage: playdemo <filename>');
        return;
      }
      const filename = args[0];
      console.log(`playdemo: ${filename}`);
      console.log('Note: Demo loading requires VFS access which is not yet fully integrated into this console command.');
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
        if (menuSystem.isActive()) {
            menuSystem.closeAll();
        } else if (pauseMenuFactory) {
            menuSystem.pushMenu(pauseMenuFactory.createPauseMenu());
        }
    }, 'Toggle the main/pause menu');

    if (imports.host.cvars) {
      imports.host.cvars.register({
        name: 'fov',
        defaultValue: '90',
        flags: CvarFlags.Archive,
        onChange: (cvar) => {
          const f = cvar.number;
          if (!isNaN(f)) {
            fovValue = Math.max(1, Math.min(179, f));
          }
        },
        description: 'Field of view'
      });

      // Initialize fovValue from cvar
      const initialFov = imports.host.cvars.get('fov');
      if (initialFov) {
        const f = initialFov.number;
         if (!isNaN(f)) {
          fovValue = Math.max(1, Math.min(179, f));
        }
      }
    }
  }

  const clientExports: ClientExports = {
    loadingScreen,
    errorDialog,

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
         loadingScreen.start(100, 'Loading assets...'); // Mock total
         // Actually Init_Hud is async. We should await it or handle promise.
         // ClientExports.Init is void.
         Init_Hud(imports.engine.renderer, imports.engine.assets).then(() => {
             loadingScreen.finish();
         });
      }

      void imports.engine.trace({ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 });

      // Setup global events
      if (typeof document !== 'undefined') {
          document.addEventListener('fullscreenchange', () => {
              if (document.fullscreenElement) {
                   if (!menuSystem.isActive()) {
                       document.body.requestPointerLock?.();
                   }
              }
          });
      }
    },

    predict(command: UserCommand): PredictionState {
      if (menuSystem.isActive()) {
          // Suppress movement if desired
      }
      return prediction.enqueueCommand(command);
    },

    handleInput(key: string, down: boolean): boolean {
        if (!menuSystem.isActive()) return false;

        if (!down) return true;

        const lowerKey = key.toLowerCase();

        if (lowerKey === 'arrowup' || lowerKey === 'w') {
            return menuSystem.handleInput('up');
        } else if (lowerKey === 'arrowdown' || lowerKey === 's') {
            return menuSystem.handleInput('down');
        } else if (lowerKey === 'arrowleft' || lowerKey === 'a') {
            return menuSystem.handleInput('left');
        } else if (lowerKey === 'arrowright' || lowerKey === 'd') {
            return menuSystem.handleInput('right');
        } else if (lowerKey === 'enter' || lowerKey === ' ') {
            return menuSystem.handleInput('select');
        } else if (lowerKey === 'escape') {
             if (menuSystem.getState().activeMenu?.parent) {
                 return menuSystem.handleInput('back');
             }
             return false;
        } else if (key.length === 1) {
            return menuSystem.handleInput('char', key);
        } else if (key === 'Backspace') {
            return menuSystem.handleInput('left');
        }

        return true;
    },

    toggleMenu() {
        if (menuSystem.isActive()) {
            menuSystem.closeAll();
            // Save settings when closing menu
            if (imports.host?.cvars) {
                 const list = imports.host.cvars.list().map(c => ({
                     name: c.name,
                     value: c.string,
                     flags: c.flags
                 }));
                 settings.saveCvars(list);
            }
        } else if (pauseMenuFactory) {
            menuSystem.pushMenu(pauseMenuFactory.createPauseMenu());
        }
    },

    createMainMenu(options: Omit<MainMenuOptions, 'optionsFactory' | 'mapsFactory' | 'onSetDifficulty'>, storage: SaveStorage, saveCallback: (name: string) => Promise<void>, loadCallback: (slot: string) => Promise<void>, deleteCallback: (slot: string) => Promise<void>) {
        const saveLoadFactory = new SaveLoadMenuFactory(menuSystem, storage, saveCallback, loadCallback, deleteCallback);
        let optsFactory = optionsFactory;
        if (!optsFactory) {
            if (!imports.host) {
                throw new Error('Cannot create Main Menu: EngineHost is missing');
            }
            optsFactory = new OptionsMenuFactory(menuSystem, imports.host);
        }

        const assets = imports.engine.assets;
        const vfsShim = {
             findByExtension: (ext: string) => assets ? assets.listFiles(ext) : []
        };

        const mapsFactory = new MapsMenuFactory(menuSystem, vfsShim as any, (map) => {
             console.log(`Starting map: ${map}`);
             imports.host?.commands.execute(`map ${map}`);
        });

        const factory = new MainMenuFactory(menuSystem, saveLoadFactory, {
            ...options,
            optionsFactory: optsFactory,
            mapsFactory,
            onSetDifficulty: (skill: number) => {
                if (imports.host?.cvars) {
                    imports.host.cvars.setValue('skill', skill.toString());
                }
            }
        });

        return { menuSystem, factory };
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
        camera.aspect = 4 / 3; // Default aspect

        // Update aspect from renderer
        if (imports.engine.renderer) {
            camera.aspect = imports.engine.renderer.width / imports.engine.renderer.height;
        }
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

        this.DrawHUD(stats, timeMs);
      }

      return command;
    },

    DrawHUD(stats: FrameRenderStats, timeMs: number) {
        if (!imports.engine.renderer) return;

        if (lastRendered && lastRendered.client) {
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
                pickupIcon: lastRendered.pickupIcon,
                centerPrint: messageSystem['centerPrintMsg']?.text, // Hack to get text for legacy state? No, Draw_Hud uses messageSystem directly now.
                notify: undefined
            };

            const playbackState = demoPlayback.getState();
            const hudTimeMs = (playbackState === PlaybackState.Playing || playbackState === PlaybackState.Paused)
                ? (demoHandler.latestFrame?.serverFrame || 0) * 100
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
        }

        if (menuSystem.isActive()) {
            Draw_Menu(imports.engine.renderer, menuSystem.getState(), imports.engine.renderer.width, imports.engine.renderer.height);
        }

        if (lastRendered && lastRendered.client) {
            wheelMenuSystem.render(imports.engine.renderer, imports.engine.renderer.width, imports.engine.renderer.height, lastRendered.client as PlayerClient);
        }

        errorDialog.render(imports.engine.renderer);
        loadingScreen.render(imports.engine.renderer);
    },

    shutdown() {
      this.Shutdown();
    },

    Shutdown() {
      latestFrame = undefined;
      lastRendered = undefined;
      // Save settings on shutdown
       if (imports.host?.cvars) {
             const list = imports.host.cvars.list().map(c => ({
                 name: c.name,
                 value: c.string,
                 flags: c.flags
             }));
             settings.saveCvars(list);
        }
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

      if (imports.engine.assets) {
          const assets = imports.engine.assets;

          if (index >= ConfigStringIndex.Models && index < ConfigStringIndex.Models + MAX_MODELS) {
              const ext = value.split('.').pop()?.toLowerCase();
              if (ext === 'md2') {
                  assets.loadMd2Model(value).catch(e => console.warn(`Failed to precache MD2 ${value}`, e));
              } else if (ext === 'sp2') {
                  assets.loadSprite(value).catch(e => console.warn(`Failed to precache Sprite ${value}`, e));
              } else if (ext === 'md3') {
                  assets.loadMd3Model(value).catch(e => console.warn(`Failed to precache MD3 ${value}`, e));
              }
          } else if (index >= ConfigStringIndex.Sounds && index < ConfigStringIndex.Sounds + MAX_SOUNDS) {
               assets.loadSound(value).catch(e => console.warn(`Failed to precache sound ${value}`, e));
          } else if (index >= ConfigStringIndex.Images && index < ConfigStringIndex.Images + MAX_IMAGES) {
               assets.loadTexture(value).then(texture => {
                   if (imports.engine.renderer) {
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
