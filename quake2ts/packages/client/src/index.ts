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
  RenderableEntity,
} from '@quake2ts/engine';
import { UserCommand, Vec3, PlayerState, hasPmFlag, PmFlag, ConfigStringIndex, MAX_MODELS, MAX_SOUNDS, MAX_IMAGES, CvarFlags, EntityState, mat4FromBasis, PlayerStat } from '@quake2ts/shared';
import { vec3, mat4 } from 'gl-matrix';
// Updated imports to use @quake2ts/cgame
import { ClientPrediction, interpolatePredictionState, PredictionState, GetCGameAPI, CGameExport } from '@quake2ts/cgame';
import { ViewEffects, ViewSample } from '@quake2ts/cgame';
import { createCGameImport, ClientStateProvider } from './cgameBridge.js';

import { Draw_Hud, Init_Hud } from './hud.js';
import { FrameRenderStats, WorldRenderState } from '@quake2ts/engine';
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
import { MultiplayerMenuFactory } from './ui/menu/multiplayer.js';
import { Draw_Menu } from './ui/menu/render.js';
import { InputBindings } from './input/bindings.js';
import { BrowserSettings, LocalStorageSettings } from './ui/storage.js';
import { LoadingScreen } from './ui/loading/screen.js';
import { ErrorDialog } from './ui/error.js';
import { WheelMenuSystem } from './ui/wheels/index.js';
import { angleVectors } from '@quake2ts/shared';
import { buildRenderableEntities } from './entities.js';
import { MultiplayerConnection } from './net/connection.js';

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

// Re-export from cgame if needed, or consumers should import directly
export {
  ClientPrediction,
  interpolatePredictionState,
} from '@quake2ts/cgame';
export type { PredictionSettings, PredictionState } from '@quake2ts/cgame';

export { ViewEffects } from '@quake2ts/cgame';
export type { ViewEffectSettings, ViewKick, ViewSample } from '@quake2ts/cgame';

export { ClientConfigStrings } from './configStrings.js';

const ZERO_VEC3: Vec3 = { x: 0, y: 0, z: 0 };

export interface ClientImports {
  readonly engine: EngineImports & { renderer: Renderer; cmd?: { executeText(text: string): void } };
  readonly host?: EngineHost;
}

export enum ClientMode {
  Normal,
  DemoPlayback,
  Multiplayer
}

export interface ClientExports extends ClientRenderer<PredictionState> {
  // Core Engine Hooks
  predict(command: UserCommand): PredictionState;
  ParseCenterPrint(msg: string): void;
  ParseNotify(msg: string): void;
  ParseConfigString(index: number, value: string): void;
  showSubtitle(text: string, soundName: string): void;

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
  readonly isDemoPlaying: boolean;
  readonly currentDemoName: string | null;
  readonly mode: ClientMode;
  startDemoPlayback(buffer: ArrayBuffer, filename: string): void;
  stopDemoPlayback(): void;

  // Networking
  multiplayer: MultiplayerConnection;

  // Menu System
  createMainMenu(options: Omit<MainMenuOptions, 'optionsFactory' | 'mapsFactory' | 'onSetDifficulty' | 'multiplayerFactory'>, storage: SaveStorage, saveCallback: (name: string) => Promise<void>, loadCallback: (slot: string) => Promise<void>, deleteCallback: (slot: string) => Promise<void>): { menuSystem: MenuSystem, factory: MainMenuFactory };

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

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpAngle(a: number, b: number, t: number): number {
    // Simple lerp for now, should ideally handle wrapping
    return lerp(a, b, t);
}

export function createClient(imports: ClientImports): ClientExports {
  // Adapter for pointContents using trace
  const pointContents = (point: Vec3): number => {
      const zero: Vec3 = { x: 0, y: 0, z: 0 };
      // Perform a point trace to get contents
      const tr = imports.engine.trace(point, point, zero, zero);
      return tr.contents || 0;
  };

  const prediction = new ClientPrediction(imports.engine.trace, pointContents);
  const view = new ViewEffects();
  const demoPlayback = new DemoPlaybackController();
  const demoHandler = new ClientNetworkHandler(imports);
  demoHandler.setView(view);

  let isDemoPlaying = false;
  let currentDemoName: string | null = null;
  let clientMode: ClientMode = ClientMode.Normal;

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

  const configStrings = new ClientConfigStrings();

  // Define State Provider for CGame first
  let latestFrame: GameFrameResult<PredictionState> | undefined;
  let clientInAutoDemo = false;

  const stateProvider: ClientStateProvider = {
    get tickRate() { return 10; }, // Default 10Hz
    get frameTimeMs() { return latestFrame?.timeMs ?? 0; },
    get serverFrame() { return demoHandler.latestServerFrame; },
    get serverProtocol() { return 34; },
    get configStrings() { return configStrings; },
    getClientName: (num) => `Player ${num}`,
    getKeyBinding: (key) => `[${key}]`,
    get inAutoDemo() { return clientInAutoDemo; }
  };

  // CGame Interface
  const cgameImport = createCGameImport(imports, stateProvider);
  const cg: CGameExport = GetCGameAPI(cgameImport);

  // Networking
  const multiplayer = new MultiplayerConnection({
      get username() { return imports.host?.cvars?.get('name')?.string || 'Player'; },
      get model() { return imports.host?.cvars?.get('model')?.string || 'male'; },
      get skin() { return imports.host?.cvars?.get('skin')?.string || 'grunt'; },
      get fov() { return fovValue; }
  });

  const multiplayerFactory = new MultiplayerMenuFactory(menuSystem, multiplayer);

  // Hook up message system to demo handler via CG
  demoHandler.setCallbacks({
    onCenterPrint: (msg: string) => cg.ParseCenterPrint(msg, 0, false),
    onPrint: (level: number, msg: string) => cg.NotifyMessage(0, msg, false),
    onConfigString: (index: number, str: string) => {
      configStrings.set(index, str);
      cg.ParseConfigString(index, str);
    },
    onServerData: (protocol: number, tickRate?: number) => {
        if (tickRate && tickRate > 0) {
            demoPlayback.setFrameDuration(1000 / tickRate);
        } else {
            demoPlayback.setFrameDuration(100); // 10Hz fallback
        }
    }
  });

  demoPlayback.setHandler(demoHandler);

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

    imports.host.commands.register('connect', (args) => {
        if (args.length < 1) {
            console.log('usage: connect <address>');
            return;
        }
        const address = args[0];
        console.log(`Connecting to ${address}...`);
        multiplayer.connect(address).catch(e => {
            console.error('Failed to connect:', e);
            errorDialog.show('Connection Failed', e instanceof Error ? e.message : 'Unknown error');
        });
    }, 'Connect to a multiplayer server');

    imports.host.commands.register('disconnect', () => {
        multiplayer.disconnect();
        console.log('Disconnected.');
    }, 'Disconnect from server');

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

      // Initialize CGame
      cg.Init();

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

      // If connected to multiplayer, send command to server
      if (multiplayer.isConnected()) {
          multiplayer.sendCommand(command);
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

    createMainMenu(options: Omit<MainMenuOptions, 'optionsFactory' | 'mapsFactory' | 'onSetDifficulty' | 'multiplayerFactory'>, storage: SaveStorage, saveCallback: (name: string) => Promise<void>, loadCallback: (slot: string) => Promise<void>, deleteCallback: (slot: string) => Promise<void>) {
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
            multiplayerFactory,
            onSetDifficulty: (skill: number) => {
                if (imports.host?.cvars) {
                    imports.host.cvars.setValue('skill', skill.toString());
                }
            }
        });

        return { menuSystem, factory };
    },

    render(sample: GameRenderSample<PredictionState>): UserCommand {
      // Keep track of entities to render
      let renderEntities: RenderableEntity[] = [];

      if (isDemoPlaying) {
          // Update demo playback with delta time since last frame
          const frameTimeMs = sample.latest && sample.previous ? Math.max(0, sample.latest.timeMs - sample.previous.timeMs) : 0;
          demoPlayback.update(frameTimeMs);

          lastRendered = demoHandler.getPredictionState(demoPlayback.getCurrentTime());
          // TODO: Demo playback entities
      } else {
          if (sample.latest?.state) {
            prediction.setAuthoritative(sample.latest);
            latestFrame = sample.latest;
          }

          if (sample.previous?.state && sample.latest?.state) {
            lastRendered = interpolatePredictionState(sample.previous.state, sample.latest.state, sample.alpha);

            // Interpolate entities
            if ((sample.latest.state as any).packetEntities && (sample.previous.state as any).packetEntities) {
                renderEntities = buildRenderableEntities(
                    (sample.latest.state as any).packetEntities,
                    (sample.previous.state as any).packetEntities,
                    sample.alpha,
                    configStrings,
                    imports
                );
            }

          } else {
            lastRendered = sample.latest?.state ?? sample.previous?.state ?? prediction.getPredictedState();
          }
      }

      const frameTimeMs = sample.latest && sample.previous ? Math.max(0, sample.latest.timeMs - sample.previous.timeMs) : 0;
      lastView = view.sample(lastRendered, frameTimeMs);

      const command = {} as UserCommand;

      if (lastRendered) {
        const { origin, viewAngles } = lastRendered;
        camera = new Camera();
        camera.position = vec3.fromValues(origin.x, origin.y, origin.z);
        // Add view offset
        const viewOffset = lastView?.offset ?? { x: 0, y: 0, z: 0 };
        vec3.add(camera.position, camera.position, [viewOffset.x, viewOffset.y, viewOffset.z]);

        // Add view effects angles
        const effectAngles = lastView?.angles ?? { x: 0, y: 0, z: 0 };
        camera.angles = vec3.fromValues(viewAngles.x + effectAngles.x, viewAngles.y + effectAngles.y, viewAngles.z + effectAngles.z);

        camera.fov = isZooming ? 40 : fovValue;
        camera.aspect = 4 / 3; // Default aspect

        // Update aspect from renderer
        if (imports.engine.renderer) {
            camera.aspect = imports.engine.renderer.width / imports.engine.renderer.height;
        }
      }

      // RENDER THE WORLD
      if (imports.engine.renderer && camera) {
          // Retrieve current map if available
          // Usually index 1 in configstrings is map model: "maps/base1.bsp"
          // NOTE: Q2 configstring CS_MODELS+1 is the world model.
          let world: WorldRenderState | undefined;

          if (imports.engine.assets) {
              // CS_MODELS is 32. So model index 1 is at 33.
              const mapName = configStrings.getModelName(1);
              if (mapName) {
                  const bspMap = imports.engine.assets.getMap(mapName);

                  if (bspMap) {
                      // Construct world state.
                      // For now we mock surfaces/lightmaps as they are built in renderer internals usually?
                  }
              }
          }

          imports.engine.renderer.renderFrame({
              camera,
              world,
              // Lighting?
              dlights: [] // TODO: Dynamic lights
          }, renderEntities);
      }

      if (imports.engine.renderer && lastRendered && lastRendered.client) {
        const stats: FrameRenderStats = imports.engine.renderer.stats ? {
             ...imports.engine.renderer.stats,
             batches: 0, facesDrawn: 0, drawCalls: 0, skyDrawn: false, viewModelDrawn: false, fps: 0, vertexCount: 0
        } : {
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

        const renderer = imports.engine.renderer;
        const width = renderer.width;
        const height = renderer.height;

        if (lastRendered && lastRendered.client) {
             const playerState: PlayerState = {
                origin: lastRendered.origin,
                velocity: lastRendered.velocity,
                viewAngles: lastRendered.viewAngles,
                onGround: hasPmFlag(lastRendered.pmFlags, PmFlag.OnGround),
                waterLevel: lastRendered.waterLevel,
                mins: { x: -16, y: -16, z: -24 },
                maxs: { x: 16, y: 16, z: 32 },
                damageAlpha: lastRendered.damageAlpha ?? 0,
                damageIndicators: lastRendered.damageIndicators ?? [],
                blend: lastRendered.blend ?? [0, 0, 0, 0],
                pickupIcon: lastRendered.pickupIcon,
                centerPrint: undefined, // Handled by CGame MessageSystem now
                notify: undefined,

                // Stubs for new fields
                // Ensure stats are safely initialized
                stats: lastRendered.stats ? [...lastRendered.stats] : new Array(32).fill(0),
                kick_angles: ZERO_VEC3,
                kick_origin: ZERO_VEC3,
                gunoffset: ZERO_VEC3,
                gunangles: ZERO_VEC3,
                gunindex: 0,

                // New fields for Q2 network compatibility
                pm_type: lastRendered.pm_type ?? 0,
                pm_time: lastRendered.pm_time ?? 0,
                pm_flags: lastRendered.pmFlags,
                gun_frame: lastRendered.gun_frame ?? 0,
                rdflags: lastRendered.rdflags ?? 0,
                fov: lastRendered.fov ?? 90
            };

            // Populate stats for status bar (Health, Armor, Ammo) if not already populated by server
            playerState.stats[PlayerStat.STAT_HEALTH] = lastRendered.health ?? 0;
            playerState.stats[PlayerStat.STAT_AMMO] = lastRendered.ammo ?? 0;
            playerState.stats[PlayerStat.STAT_ARMOR] = lastRendered.armor ?? 0;

            // Call CGame DrawHUD wrapper
            // Note: client.ts's DrawHUD calls Draw_Hud from hud.ts
            // But we should use cg.DrawHUD eventually.

            renderer.begin2D();
            cg.DrawHUD(
                0, // isplit
                null, // data
                { x: 0, y: 0, width, height }, // hud_vrect
                { x: 0, y: 0, width, height }, // hud_safe
                1.0, // scale
                0, // playernum
                playerState
            );
            renderer.end2D();
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
      // Shutdown CGame
      cg.Shutdown();

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
    get isDemoPlaying() {
        return isDemoPlaying;
    },
    get currentDemoName() {
        return currentDemoName;
    },
    get mode() {
        return clientMode;
    },
    startDemoPlayback(buffer: ArrayBuffer, filename: string) {
        demoPlayback.loadDemo(buffer);
        demoPlayback.setHandler(demoHandler);
        isDemoPlaying = true;
        currentDemoName = filename;
        clientMode = ClientMode.DemoPlayback;
        // Reset state
        configStrings.clear(); // Clear existing configstrings
    },
    stopDemoPlayback() {
        demoPlayback.stop();
        isDemoPlaying = false;
        currentDemoName = null;
        clientMode = ClientMode.Normal;
        // Clean up
    },
    ParseCenterPrint(msg: string) {
      cg.ParseCenterPrint(msg, 0, false);
    },
    ParseNotify(msg: string) {
      cg.NotifyMessage(0, msg, false);
    },
    showSubtitle(text: string, soundName: string) {
      cg.ShowSubtitle(text, soundName);
    },
    ParseConfigString(index: number, value: string) {
      configStrings.set(index, value);
      cg.ParseConfigString(index, value);
    },
    demoHandler,
    multiplayer,
    configStrings
  };

  return clientExports;
}
