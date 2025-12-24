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
import { UserCommand, Vec3, PlayerState, hasPmFlag, PmFlag, ConfigStringIndex, MAX_MODELS, MAX_SOUNDS, MAX_IMAGES, CvarFlags, EntityState, mat4FromBasis, PlayerStat, RenderFx, MAX_CLIENTS, CONTENTS_WATER, CONTENTS_LAVA, CONTENTS_SLIME } from '@quake2ts/shared';
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
import { DemoMenuFactory } from './ui/menu/demo.js';
import { Draw_Menu } from './ui/menu/render.js';
import { InputBindings } from './input/bindings.js';
import { BrowserSettings, LocalStorageSettings } from './ui/storage.js';
import { LoadingScreen } from './ui/loading/screen.js';
import { ErrorDialog } from './ui/error.js';
import { WheelMenuSystem } from './ui/wheels/index.js';
import { angleVectors, vectorToAngles } from '@quake2ts/shared';
import { buildRenderableEntities } from './entities.js';
import { MultiplayerConnection } from './net/connection.js';
import { DemoControls } from './ui/demo-controls.js';
import { DemoRecorder, DLight, DynamicLightManager, FogData, DamageIndicator } from '@quake2ts/engine';
import { DemoCameraMode, DemoCameraState } from './demo/camera.js';
import { processEntityEffects } from './effects.js';
import { ClientEffectSystem, EntityProvider } from './effects-system.js';
import { createBlendState, updateBlend } from './blend.js';
import { ScoreboardManager, ScoreboardData, ScoreboardEntry } from './scoreboard.js';
import { ChatManager } from './chat.js';
import { HudData, StatusBarData, CrosshairInfo } from './hud/data.js';
import { MenuState } from './ui/menu/types.js';
import { lodRegistry, LodModel } from './lod.js';

export { createDefaultBindings, InputBindings, normalizeCommand, normalizeInputCode } from './input/bindings.js';
import { InputController, InputSource } from './input/controller.js';
export {
  GamepadLike,
  GamepadLikeButton,
  InputAction,
  InputController,
  InputSource,
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
  defaultPredictionState,
} from '@quake2ts/cgame';
export type { PredictionSettings, PredictionState } from '@quake2ts/cgame';

export { ViewEffects } from '@quake2ts/cgame';
export type { ViewEffectSettings, ViewKick, ViewSample } from '@quake2ts/cgame';

export { ClientConfigStrings } from './configStrings.js';
export * from './scoreboard.js';

export { HudData, StatusBarData, CrosshairInfo } from './hud/data.js';

export * from './session.js';
export * from './demo/camera.js'; // Export DemoCameraMode
export { queryMasterServer, type ServerInfo } from './net/master.js';

const ZERO_VEC3: Vec3 = { x: 0, y: 0, z: 0 };

export interface ClientImports {
  readonly engine: EngineImports & { renderer: Renderer; cmd?: { executeText(text: string): void } };
  readonly host?: EngineHost;
  readonly inputController?: InputController;
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

  // Demo Camera
  setDemoCameraMode(mode: DemoCameraMode): void;
  setDemoThirdPersonDistance(dist: number): void;
  setDemoThirdPersonOffset(offset: Vec3): void;
  setDemoFreeCamera(origin: Vec3, angles: Vec3): void;
  setDemoFollowEntity(entityId: number): void;

  // Spectator API
  setSpectatorTarget(targetEntityId: number | null): void;
  getSpectatorTargets(): { id: number; name: string }[];

  // Networking
  multiplayer: MultiplayerConnection;

  // Recording
  startRecording(filename: string): void;
  stopRecording(): void;

  // Menu System
  createMainMenu(options: Omit<MainMenuOptions, 'optionsFactory' | 'mapsFactory' | 'onSetDifficulty' | 'multiplayerFactory'>, storage: SaveStorage, saveCallback: (name: string) => Promise<void>, loadCallback: (slot: string) => Promise<void>, deleteCallback: (slot: string) => Promise<void>): { menuSystem: MenuSystem, factory: MainMenuFactory };
  showPauseMenu(): void;
  hidePauseMenu(): void;
  isMenuActive(): boolean;
  onMenuStateChange?: (active: boolean) => void;
  getMenuState(): MenuState;

  // Input handling
  handleInput(key: string, down: boolean): boolean;
  toggleMenu(): void;
  bindInputSource(source: InputSource): void;
  setKeyBinding(action: string, keys: string[]): void;
  getDefaultBindings(): InputBindings;
  onInputCommand?: (cmd: UserCommand) => void;

  // cgame_export_t equivalents (if explicit names required)
  Init(initial?: GameFrameResult<PredictionState>): void;
  Shutdown(): void;
  DrawHUD(stats: FrameRenderStats, timeMs: number): void;

  // New UI components
  readonly loadingScreen: LoadingScreen;
  readonly errorDialog: ErrorDialog;

  readonly dlightManager: DynamicLightManager;

  // Scoreboard API
  getScoreboard(): ScoreboardData;
  onScoreboardUpdate?: (scoreboard: ScoreboardData) => void;

  // Chat API
  sendChatMessage(message: string, team?: boolean): void;
  onChatMessage?: (sender: string, message: string, team: boolean) => void;
  getChatHistory(): any[];

  // HUD Data API
  getHudData(): HudData | null;
  getStatusBar(): StatusBarData | null;
  getCrosshairInfo(): CrosshairInfo;
  onHudUpdate?: (data: HudData) => void;

  // Message Events
  onCenterPrint?: (message: string, duration: number) => void;
  onNotify?: (message: string) => void;
  onPickupMessage?: (item: string) => void;
  onObituaryMessage?: (message: string) => void;

  // LOD
  registerLod(baseModel: string, lods: LodModel[]): void;
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

  const prediction = new ClientPrediction({ trace: imports.engine.trace, pointContents });
  const view = new ViewEffects();
  const demoPlayback = new DemoPlaybackController();
  const demoControls = new DemoControls(demoPlayback, (speed) => {
      // Propagate speed change to AudioSystem if available
      if (imports.engine.audio) {
          // Assuming AudioApi has setPlaybackRate or we need to cast/access internal
          // AudioApi from host usually has setPlaybackRate if we added it to interface
          // But AudioApi is an interface in engine/src/audio/api.ts.
          // We implemented setPlaybackRate in AudioSystem, but AudioApi needs to expose it.
          // Let's check AudioApi. If not, we cast or assume for now, then fix interface.
          const audio = imports.engine.audio as any;
          if (typeof audio.setPlaybackRate === 'function') {
              audio.setPlaybackRate(speed);
          }
      }
  });
  const demoHandler = new ClientNetworkHandler(imports);
  const demoRecorder = new DemoRecorder();
  demoHandler.setView(view);

  const dlightManager = new DynamicLightManager();

  // Entity Provider for effects system
  // Needs to handle both demo playback and multiplayer/prediction states
  // We need to cast types because 'EntityState' definition varies slightly between shared/engine/parser context
  // The 'EntityState' imported in effects-system.ts is from @quake2ts/engine
  const entityProvider: EntityProvider = {
      getEntity(entNum: number) {
          if (isDemoPlaying) {
              // Demo handler maintains current frame entities
              return demoHandler.entities.get(entNum);
          } else {
              // Multiplayer / Local
              // Check multiplayer connection first
              if (multiplayer.isConnected()) {
                  // MultiplayerConnection needs to expose entities map
                  return multiplayer.entities.get(entNum);
              }
          }
          return undefined;
      },
      getPlayerNum(): number {
          return multiplayer.playerNum; // Or demoHandler.playerNum
      }
  };

  const effectSystem = new ClientEffectSystem(dlightManager, imports.engine, entityProvider);

  let isDemoPlaying = false;
  let currentDemoName: string | null = null;
  let clientMode: ClientMode = ClientMode.Normal;

  // Demo Camera State
  const demoCameraState: DemoCameraState = {
      mode: DemoCameraMode.FirstPerson,
      thirdPersonDistance: 80,
      thirdPersonOffset: { x: 0, y: 0, z: 0 },
      freeCameraOrigin: { x: 0, y: 0, z: 0 },
      freeCameraAngles: { x: 0, y: 0, z: 0 },
      followEntityId: -1
  };

  const inputController = imports.inputController ?? new InputController();
  inputController.onInputCommand = (cmd) => {
      if (clientExports.onInputCommand) {
          clientExports.onInputCommand(cmd);
      }
  };

  // State to track key inputs for free camera movement
  const inputState = {
    forward: false,
    backward: false,
    left: false,
    right: false,
    up: false,
    down: false
  };

  // Initialize persistent Menu System
  const menuSystem = new MenuSystem();
  menuSystem.onStateChange = (active) => {
      if (clientExports.onMenuStateChange) {
          clientExports.onMenuStateChange(active);
      }
  };

  // Initialize UI components
  const loadingScreen = new LoadingScreen();
  const errorDialog = new ErrorDialog();
  const wheelMenuSystem = new WheelMenuSystem();
  const settings = new BrowserSettings(new LocalStorageSettings());

  // Menu Factories
  let pauseMenuFactory: PauseMenuFactory | undefined;
  let optionsFactory: OptionsMenuFactory | undefined;

  const configStrings = new ClientConfigStrings();
  const scoreboardManager = new ScoreboardManager(configStrings);

  const chatManager = new ChatManager((cmd) => {
      if (imports.engine.cmd) {
          imports.engine.cmd.executeText(cmd);
      }
  });

  const blendState = createBlendState();
  let currentBlend: [number, number, number, number] = [0, 0, 0, 0];
  let pendingDamage = 0;

  // Define State Provider for CGame first
  let latestFrame: GameFrameResult<PredictionState> | undefined;
  let lastRenderTime = 0;
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
  const cgameImport = createCGameImport(imports, stateProvider, (msg) => {
      // Use level 0 (PRINT_LOW/INFO) for general output
      chatManager.addMessage(0, msg);
  });
  const cg: CGameExport = GetCGameAPI(cgameImport);

  // Networking
  const multiplayer = new MultiplayerConnection({
      get username() { return imports.host?.cvars?.get('name')?.string || 'Player'; },
      get model() { return imports.host?.cvars?.get('model')?.string || 'male'; },
      get skin() { return imports.host?.cvars?.get('skin')?.string || 'grunt'; },
      get fov() { return fovValue; }
  });
  multiplayer.setDemoRecorder(demoRecorder);
  multiplayer.setEffectSystem(effectSystem); // Inject Effect System

  const multiplayerFactory = new MultiplayerMenuFactory(menuSystem, multiplayer);

  // Helper to process CD tracks
  const processCdTrack = (trackStr: string) => {
      if (!imports.engine.audio) return;

      const track = parseInt(trackStr, 10);
      if (!isNaN(track)) {
          // Tracks 0 and 1 are usually ignored (data)
          if (track >= 2) {
              // Use exposed play_track from AudioApi
              if (imports.engine.audio.play_track) {
                  void imports.engine.audio.play_track(track);
              } else {
                  // Fallback if play_track isn't available (should not happen if engine updated)
                  const trackName = `music/track${track.toString().padStart(2, '0')}.ogg`;
                  void imports.engine.audio.play_music(trackName);
              }
          } else {
              imports.engine.audio.stop_music();
          }
      }
  };

  // Hook up message system to demo handler via CG
  demoHandler.setCallbacks({
    onCenterPrint: (msg: string) => cg.ParseCenterPrint(msg, 0, false),
    onPrint: (level: number, msg: string) => {
        cg.NotifyMessage(0, msg, false);
        chatManager.addMessage(level, msg);
    },
    onConfigString: (index: number, str: string) => {
      configStrings.set(index, str);
      cg.ParseConfigString(index, str);

      // Trigger scoreboard update if player skin changes
      if (index >= ConfigStringIndex.PlayerSkins && index < ConfigStringIndex.PlayerSkins + MAX_CLIENTS) {
        scoreboardManager.parseConfigString(index, str);
        scoreboardManager.notifyUpdate();
      }

      // Handle CD Track
      if (index === ConfigStringIndex.CdTrack) {
          processCdTrack(str);
      }
    },
    onServerData: (protocol: number, tickRate?: number) => {
        if (tickRate && tickRate > 0) {
            demoPlayback.setFrameDuration(1000 / tickRate);
        } else {
            demoPlayback.setFrameDuration(100); // 10Hz fallback
        }
    },
    // New hooks for effects
    onMuzzleFlash: (ent: number, weapon: number) => {
         const time = demoPlayback.getCurrentTime() / 1000.0;
         effectSystem.onMuzzleFlash(ent, weapon, time);
    },
    onMuzzleFlash2: (ent: number, weapon: number) => {
         // TODO: Implement MZ2 handling
    },
    onTempEntity: (type: number, pos: Vec3, pos2?: Vec3, dir?: Vec3, cnt?: number, color?: number, ent?: number, srcEnt?: number, destEnt?: number) => {
        const time = demoPlayback.getCurrentTime() / 1000.0;
        if (pos) {
            effectSystem.onTempEntity(type, pos, time, dir, pos2);
        }
    },
    onDamage: (indicators: DamageIndicator[]) => {
        pendingDamage = 0.5;
    },
    onLayout: (layout: string) => {
        scoreboardManager.processScoreboardMessage(layout);
        scoreboardManager.notifyUpdate();
    }
  });

  demoPlayback.setHandler(demoHandler);

  let lastRendered: PredictionState | undefined;
  let lastView: ViewSample | undefined;
  let camera: Camera | undefined;

  // Default FOV
  let fovValue = 90;
  let isZooming = false;
  let flashlightEnabled = false;

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

    imports.host.commands.register('record', (args) => {
        const name = args.length > 0 ? args[0] : `demo_${Date.now()}`;
        clientExports.startRecording(name + '.dm2');
    }, 'Record a demo');

    imports.host.commands.register('stop', () => {
        clientExports.stopRecording();
    }, 'Stop recording demo');

    imports.host.commands.register('flashlight', () => {
        flashlightEnabled = !flashlightEnabled;
        if (imports.host?.cvars) {
            imports.host.cvars.setValue('cl_flashlight', flashlightEnabled ? '1' : '0');
        }
    }, 'Toggle flashlight');

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

       imports.host.cvars.register({
        name: 'cl_flashlight',
        defaultValue: '0',
        flags: CvarFlags.Archive,
        onChange: (cvar) => {
            flashlightEnabled = cvar.number !== 0;
        },
        description: 'Flashlight toggle'
      });

      imports.host.cvars.register({
          name: 'cl_predict',
          defaultValue: '1',
          flags: CvarFlags.Archive,
          onChange: (cvar) => {
              prediction.setPredictionEnabled(cvar.number !== 0);
          },
          description: 'Toggle client-side prediction'
      });

      imports.host.cvars.register({
          name: 's_musicvolume',
          defaultValue: '1',
          flags: CvarFlags.Archive,
          onChange: (cvar) => {
              const vol = cvar.number;
              if (!isNaN(vol)) {
                  // Defensive call in case engine interface is partial
                  const audio = imports.engine.audio as any;
                  if (audio && typeof audio.set_music_volume === 'function') {
                      audio.set_music_volume(Math.max(0, Math.min(1, vol)));
                  }
              }
          },
          description: 'Music volume'
      });

      imports.host.cvars.register({
          name: 'vid_gamma',
          defaultValue: '1.0',
          flags: CvarFlags.Archive,
          onChange: (cvar) => {
              const val = cvar.number;
              if (!isNaN(val) && imports.engine.renderer) {
                  imports.engine.renderer.setGamma(val);
              }
          },
          description: 'Gamma correction'
      });

      imports.host.cvars.register({
          name: 'r_brightness',
          defaultValue: '1.0',
          flags: CvarFlags.Archive,
          onChange: (cvar) => {
              const val = cvar.number;
              if (!isNaN(val) && imports.engine.renderer) {
                  imports.engine.renderer.setBrightness(val);
              }
          },
          description: 'Brightness control'
      });

      imports.host.cvars.register({
          name: 'r_bloom',
          defaultValue: '0',
          flags: CvarFlags.Archive,
          onChange: (cvar) => {
              if (imports.engine.renderer) {
                  imports.engine.renderer.setBloom(cvar.number !== 0);
              }
          },
          description: 'Enable bloom effect'
      });

      imports.host.cvars.register({
          name: 'r_bloom_intensity',
          defaultValue: '0.5',
          flags: CvarFlags.Archive,
          onChange: (cvar) => {
              const val = cvar.number;
              if (!isNaN(val) && imports.engine.renderer) {
                  imports.engine.renderer.setBloomIntensity(val);
              }
          },
          description: 'Bloom intensity'
      });

      // Initialize fovValue from cvar
      const initialFov = imports.host.cvars.get('fov');
      if (initialFov) {
        const f = initialFov.number;
         if (!isNaN(f)) {
          fovValue = Math.max(1, Math.min(179, f));
        }
      }

      // Initialize music volume
      const initialMusicVol = imports.host.cvars.get('s_musicvolume');
      if (initialMusicVol) {
          const vol = initialMusicVol.number;
          if (!isNaN(vol)) {
              const audio = imports.engine.audio as any;
              if (audio && typeof audio.set_music_volume === 'function') {
                  audio.set_music_volume(Math.max(0, Math.min(1, vol)));
              }
          }
      }
    }
  }

  const clientExports: ClientExports = {
    loadingScreen,
    errorDialog,
    dlightManager,

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

      // Apply initial render settings from cvars
      if (imports.engine.renderer && imports.host?.cvars) {
          const gamma = imports.host.cvars.get('vid_gamma');
          if (gamma && !isNaN(gamma.number)) {
              imports.engine.renderer.setGamma(gamma.number);
          }
          const brightness = imports.host.cvars.get('r_brightness');
          if (brightness && !isNaN(brightness.number)) {
              imports.engine.renderer.setBrightness(brightness.number);
          }
          const bloom = imports.host.cvars.get('r_bloom');
          if (bloom) {
              imports.engine.renderer.setBloom(bloom.number !== 0);
          }
          const bloomIntensity = imports.host.cvars.get('r_bloom_intensity');
          if (bloomIntensity && !isNaN(bloomIntensity.number)) {
              imports.engine.renderer.setBloomIntensity(bloomIntensity.number);
          }
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
        if (isDemoPlaying) {
             // Handle camera inputs if in Free mode
             if (demoCameraState.mode === DemoCameraMode.Free) {
                 const lowerKey = key.toLowerCase();
                 if (lowerKey === 'arrowup' || lowerKey === 'w') inputState.forward = down;
                 if (lowerKey === 'arrowdown' || lowerKey === 's') inputState.backward = down;
                 if (lowerKey === 'arrowleft' || lowerKey === 'a') inputState.left = down;
                 if (lowerKey === 'arrowright' || lowerKey === 'd') inputState.right = down;
                 if (lowerKey === 'q') inputState.up = down;
                 if (lowerKey === 'e') inputState.down = down;
             }

             if (demoControls.handleInput(key, down)) {
                 return true;
             }
             // If demo controls didn't consume input, fall through (e.g. for togglemenu)
        }

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

    bindInputSource(source: InputSource) {
        inputController.bindInputSource(source);
    },

    setKeyBinding(action: string, keys: string[]) {
        inputController.setKeyBinding(action, keys);
    },

    getDefaultBindings() {
        return inputController.getDefaultBindings();
    },

    createMainMenu(options: Omit<MainMenuOptions, 'optionsFactory' | 'mapsFactory' | 'onSetDifficulty' | 'multiplayerFactory' | 'demoFactory'>, storage: SaveStorage, saveCallback: (name: string) => Promise<void>, loadCallback: (slot: string) => Promise<void>, deleteCallback: (slot: string) => Promise<void>) {
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

        const demoFactory = new DemoMenuFactory(menuSystem, clientExports);

        const factory = new MainMenuFactory(menuSystem, saveLoadFactory, {
            ...options,
            optionsFactory: optsFactory,
            mapsFactory,
            multiplayerFactory,
            demoFactory,
            onSetDifficulty: (skill: number) => {
                if (imports.host?.cvars) {
                    imports.host.cvars.setValue('skill', skill.toString());
                }
            }
        });

        return { menuSystem, factory };
    },

    showPauseMenu() {
        if (!menuSystem.isActive() && pauseMenuFactory) {
            menuSystem.pushMenu(pauseMenuFactory.createPauseMenu());
        }
    },

    hidePauseMenu() {
        if (menuSystem.isActive()) {
            menuSystem.closeAll();
        }
    },

    isMenuActive() {
        return menuSystem.isActive();
    },

    getMenuState() {
        return menuSystem.getState();
    },

    render(sample: GameRenderSample<PredictionState>): UserCommand {
      // Keep track of entities to render
      let renderEntities: RenderableEntity[] = [];
      let currentPacketEntities: any[] = []; // Store raw packet entities for effect processing

      const now = sample.nowMs;
      const dtMs = lastRenderTime > 0 ? Math.max(0, now - lastRenderTime) : 0;
      lastRenderTime = now;

      if (isDemoPlaying) {
          // Update demo playback with delta time since last frame
          demoPlayback.update(dtMs);

          lastRendered = demoHandler.getPredictionState(demoPlayback.getCurrentTime());
          // Calculate alpha for interpolation
          const alpha = demoPlayback.getInterpolationFactor();

          // Get Camera info for LOD
          let camPos = lastRendered ? { x: lastRendered.origin.x, y: lastRendered.origin.y, z: lastRendered.origin.z } : undefined;

          renderEntities = demoHandler.getRenderableEntities(alpha, configStrings); // demo handler needs update to pass camera pos or we do it inside

          // Get packet entities for effect processing.
          if (demoHandler.latestFrame && demoHandler.latestFrame.packetEntities) {
              currentPacketEntities = demoHandler.latestFrame.packetEntities.entities;
          }

          if (lastRendered) {
             const demoCamera = demoHandler.getDemoCamera(1.0);
             // Apply Demo Camera Modes logic
             if (demoCameraState.mode === DemoCameraMode.FirstPerson) {
                  if (demoCamera) {
                      lastRendered.origin = demoCamera.origin;
                      lastRendered.viewAngles = demoCamera.angles;
                      if (demoCamera.fov) {
                         lastRendered.fov = demoCamera.fov;
                      }
                  }
             } else if (demoCameraState.mode === DemoCameraMode.ThirdPerson) {
                  if (demoCamera) {
                      // Simple third person: Move back along view angles
                      const vectors = angleVectors(demoCamera.angles);
                      const forward = vectors.forward;

                      const dist = demoCameraState.thirdPersonDistance;

                      // Calculate new origin
                      // origin - forward * dist
                      const camOrigin = { ...demoCamera.origin };
                      camOrigin.x -= forward.x * dist;
                      camOrigin.y -= forward.y * dist;
                      camOrigin.z -= forward.z * dist;

                      // Check for collision using trace
                      const traceStart = demoCamera.origin;
                      const traceEnd = camOrigin;
                      // Trace against solids (MASK_SOLID = 1)
                      // We need to define a small bounding box for the camera or use point trace
                      const mins = { x: -4, y: -4, z: -4 };
                      const maxs = { x: 4, y: 4, z: 4 };

                      const trace = imports.engine.trace(traceStart, traceEnd, mins, maxs);

                      if (trace.fraction < 1.0) {
                          // Hit something, clamp to hit position (endpos)
                          // Add a small buffer to prevent clipping right into the wall
                          lastRendered.origin = trace.endpos;
                      } else {
                          lastRendered.origin = camOrigin;
                      }
                      lastRendered.viewAngles = demoCamera.angles;
                  }
             } else if (demoCameraState.mode === DemoCameraMode.Free) {
                  // Update free camera position based on input state
                  const speed = 300 * (dtMs / 1000);
                  const vectors = angleVectors(demoCameraState.freeCameraAngles);
                  const forward = vectors.forward;
                  const right = vectors.right;
                  const up = vectors.up;

                  // Use a temporary mutable vector for calculation
                  const newOrigin = vec3.fromValues(
                      demoCameraState.freeCameraOrigin.x,
                      demoCameraState.freeCameraOrigin.y,
                      demoCameraState.freeCameraOrigin.z
                  );

                  if (inputState.forward) {
                      vec3.scaleAndAdd(newOrigin, newOrigin, [forward.x, forward.y, forward.z], speed);
                  }
                  if (inputState.backward) {
                      vec3.scaleAndAdd(newOrigin, newOrigin, [forward.x, forward.y, forward.z], -speed);
                  }
                  if (inputState.right) {
                      vec3.scaleAndAdd(newOrigin, newOrigin, [right.x, right.y, right.z], speed);
                  }
                  if (inputState.left) {
                      vec3.scaleAndAdd(newOrigin, newOrigin, [right.x, right.y, right.z], -speed);
                  }
                  if (inputState.up) {
                      vec3.scaleAndAdd(newOrigin, newOrigin, [0, 0, 1], speed);
                  }
                  if (inputState.down) {
                      vec3.scaleAndAdd(newOrigin, newOrigin, [0, 0, 1], -speed);
                  }

                  // Update state with new values
                  demoCameraState.freeCameraOrigin = { x: newOrigin[0], y: newOrigin[1], z: newOrigin[2] };
                  lastRendered.origin = { ...demoCameraState.freeCameraOrigin };
                  lastRendered.viewAngles = demoCameraState.freeCameraAngles;

             } else if (demoCameraState.mode === DemoCameraMode.Follow) {
                  if (demoCameraState.followEntityId !== -1) {
                      // Find entity in renderEntities
                      const ent = renderEntities.find(e => e.id === demoCameraState.followEntityId);
                      if (ent) {
                          const mat = ent.transform;
                          const targetOrigin = { x: mat[12], y: mat[13], z: mat[14] };

                          // Smoothing: Linear interpolation towards target
                          const smoothingFactor = 0.1; // Adjust for lag effect

                          // Initialize if missing
                          if (!demoCameraState.currentFollowOrigin) {
                              demoCameraState.currentFollowOrigin = { ...targetOrigin };
                          }

                          const current = demoCameraState.currentFollowOrigin;

                          // If far away, snap
                          if (Math.abs(current.x - targetOrigin.x) > 1000 ||
                              Math.abs(current.y - targetOrigin.y) > 1000 ||
                              Math.abs(current.z - targetOrigin.z) > 1000) {
                              demoCameraState.currentFollowOrigin = { ...targetOrigin };
                          } else {
                              const nextX = current.x + (targetOrigin.x - current.x) * smoothingFactor;
                              const nextY = current.y + (targetOrigin.y - current.y) * smoothingFactor;
                              const nextZ = current.z + (targetOrigin.z - current.z) * smoothingFactor;
                              demoCameraState.currentFollowOrigin = { x: nextX, y: nextY, z: nextZ };
                          }

                          lastRendered.origin = { ...demoCameraState.currentFollowOrigin };
                      }
                  }
             }
          }
      } else {
          if (sample.latest?.state) {
            prediction.setAuthoritative(sample.latest);
            latestFrame = sample.latest;
          }

          if (sample.previous?.state && sample.latest?.state) {
            lastRendered = interpolatePredictionState(sample.previous.state, sample.latest.state, sample.alpha);

            // Interpolate entities
            if ((sample.latest.state as any).packetEntities && (sample.previous.state as any).packetEntities) {
                const latestPacketEntities = (sample.latest.state as any).packetEntities;
                const previousPacketEntities = (sample.previous.state as any).packetEntities;

                // Determine camera pos for LOD
                const camPos = lastRendered ? { x: lastRendered.origin.x, y: lastRendered.origin.y, z: lastRendered.origin.z } : undefined;

                renderEntities = buildRenderableEntities(
                    latestPacketEntities,
                    previousPacketEntities,
                    sample.alpha,
                    configStrings,
                    imports,
                    camPos
                );
                // Use latest packet entities for effects (or interpolate if we get fancy)
                currentPacketEntities = latestPacketEntities;
            }

          } else {
            lastRendered = sample.latest?.state ?? sample.previous?.state ?? prediction.getPredictedState();
          }
      }

      const frameTimeMs = sample.latest && sample.previous ? Math.max(0, sample.latest.timeMs - sample.previous.timeMs) : 0;

      // Decay prediction error
      if (frameTimeMs > 0) {
          prediction.decayError(frameTimeMs / 1000.0);
      }

      lastView = view.sample(lastRendered, frameTimeMs);

      // Update screen blend (damage/pickup flashes)
      if (lastRendered) {
          currentBlend = updateBlend(blendState, lastRendered as unknown as PlayerState, frameTimeMs / 1000.0, pendingDamage);
          pendingDamage = 0;
      } else {
          currentBlend = [0, 0, 0, 0];
      }

      // Generate user command from input controller
      const command = inputController.buildCommand(dtMs, now, demoHandler.latestServerFrame);

      // Apply prediction
      if (!isDemoPlaying && !menuSystem.isActive()) {
         clientExports.predict(command);
      }

      // Update Dynamic Light Manager
      const timeSeconds = sample.nowMs / 1000.0;
      dlightManager.update(timeSeconds, dtMs / 1000.0);

      // Collect lights (persistent + per-frame)
      const dlights: DLight[] = [...dlightManager.getActiveLights()];

      // Process Entity Effects (Per-frame lights)
      for (const ent of currentPacketEntities) {
          processEntityEffects(ent, dlights, timeSeconds);
      }

      if (lastRendered) {
        const { origin, viewAngles } = lastRendered;
        camera = new Camera();
        camera.position = vec3.fromValues(origin.x, origin.y, origin.z);
        // Add view offset if FirstPerson
        if (!isDemoPlaying || demoCameraState.mode === DemoCameraMode.FirstPerson) {
            const viewOffset = lastView?.offset ?? { x: 0, y: 0, z: 0 };
            vec3.add(camera.position, camera.position, [viewOffset.x, viewOffset.y, viewOffset.z]);
        }

        // Add view effects angles
        const effectAngles = lastView?.angles ?? { x: 0, y: 0, z: 0 };
        camera.angles = vec3.fromValues(viewAngles.x + effectAngles.x, viewAngles.y + effectAngles.y, viewAngles.z + effectAngles.z);

        // In demo playback, prefer the recorded FOV if available
        if (isDemoPlaying && lastRendered.fov) {
            camera.fov = lastRendered.fov;
        } else {
            camera.fov = isZooming ? 40 : fovValue;
        }

        camera.aspect = 4 / 3; // Default aspect

        // Update aspect from renderer
        if (imports.engine.renderer) {
            camera.aspect = imports.engine.renderer.width / imports.engine.renderer.height;
        }

        // Flashlight logic
        if (flashlightEnabled || (lastRendered.renderfx & RenderFx.Flashlight)) {
            // Flashlight originates from view position
            const lightOrigin = { x: camera.position[0], y: camera.position[1], z: camera.position[2] };

            dlights.push({
                origin: lightOrigin,
                color: { x: 1, y: 1, z: 1 },
                intensity: 200,
                die: (sample.nowMs / 1000) + 0.1,
                minLight: 0
            });
        }
      }

      // RENDER THE WORLD
      if (imports.engine.renderer && camera) {
          let world: WorldRenderState | undefined;

          if (imports.engine.assets) {
              const mapName = configStrings.getModelName(1);
              if (mapName) {
                  const bspMap = imports.engine.assets.getMap(mapName);
                  if (bspMap) {
                      // Construct world state.
                  }
              }
          }

          // Check camera contents for water tint
          const cameraContents = pointContents({ x: camera.position[0], y: camera.position[1], z: camera.position[2] });
          let waterTint: readonly [number, number, number, number] | undefined;
          let underwaterWarp = false;

          if ((cameraContents & CONTENTS_WATER) !== 0) {
              waterTint = [0.5, 0.5, 0.6, 0.6]; // Blueish
              underwaterWarp = true;
          } else if ((cameraContents & CONTENTS_SLIME) !== 0) {
              waterTint = [0.0, 0.1, 0.05, 0.6]; // Slime green
              underwaterWarp = true;
          } else if ((cameraContents & CONTENTS_LAVA) !== 0) {
              waterTint = [1.0, 0.3, 0.0, 0.6]; // Lava red
              underwaterWarp = true;
          }

          imports.engine.renderer.setUnderwaterWarp(underwaterWarp);

          imports.engine.renderer.renderFrame({
              camera,
              world,
              dlights: dlights,
              deltaTime: dtMs / 1000.0,
              timeSeconds,
              waterTint // Pass it here
          }, renderEntities);
      }

      if (imports.engine.renderer && lastRendered && lastRendered.client) {
        const perfReport = imports.engine.renderer.getPerformanceReport();
        const stats: FrameRenderStats = {
          batches: perfReport.textureBinds,
          facesDrawn: perfReport.triangles,
          drawCalls: perfReport.drawCalls,
          skyDrawn: false,
          viewModelDrawn: false,
          fps: 0,
          vertexCount: perfReport.vertices,
        };
        const timeMs = sample.latest?.timeMs ?? 0;

        this.DrawHUD(stats, timeMs);
      }

      if (clientExports.onHudUpdate) {
          const hudData = clientExports.getHudData();
          if (hudData) {
              clientExports.onHudUpdate(hudData);
          }
      }

      return command;
    },

    DrawHUD(stats: FrameRenderStats, timeMs: number) {
        if (!imports.engine.renderer) return;

        const renderer = imports.engine.renderer;
        const width = renderer.width;
        const height = renderer.height;

        // Only draw full player HUD if not in demo mode
        if (!isDemoPlaying && lastRendered && lastRendered.client) {
             const playerState: PlayerState = {
                origin: lastRendered.origin,
                velocity: lastRendered.velocity,
                viewAngles: lastRendered.viewAngles,
                onGround: hasPmFlag(lastRendered.pmFlags, PmFlag.OnGround),
                waterLevel: lastRendered.waterLevel,
                watertype: lastRendered.watertype,
                mins: { x: -16, y: -16, z: -24 },
                maxs: { x: 16, y: 16, z: 32 },
                damageAlpha: lastRendered.damageAlpha ?? 0,
                damageIndicators: lastRendered.damageIndicators ?? [],
                blend: currentBlend,
                pickupIcon: lastRendered.pickupIcon,
                centerPrint: undefined,
                notify: undefined,

                // Stubs for new fields
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
                fov: lastRendered.fov ?? 90,
                renderfx: lastRendered.renderfx
            };

            // Populate stats for status bar (Health, Armor, Ammo) if not already populated by server
            playerState.stats[PlayerStat.STAT_HEALTH] = lastRendered.health ?? 0;
            playerState.stats[PlayerStat.STAT_AMMO] = lastRendered.ammo ?? 0;
            playerState.stats[PlayerStat.STAT_ARMOR] = lastRendered.armor ?? 0;

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

        if (isDemoPlaying) {
             demoControls.render(imports.engine.renderer, imports.engine.renderer.width, imports.engine.renderer.height);
        }

        if (lastRendered && lastRendered.client) {
            wheelMenuSystem.render(imports.engine.renderer, imports.engine.renderer.width, imports.engine.renderer.height, lastRendered.client as PlayerClient);
        }

        errorDialog.render(imports.engine.renderer);
        loadingScreen.render(imports.engine.renderer);
    },

    getHudData(): HudData | null {
        if (!lastRendered) return null;

        const health = lastRendered.health ?? 0;
        const armor = lastRendered.armor ?? 0;
        const ammo = lastRendered.ammo ?? 0;
        const fps = 60; // TODO: Calculate real FPS

        const damageIndicators = (lastRendered.damageIndicators ?? []).map(ind => ({
            angle: vectorToAngles(ind.direction).y,
            alpha: ind.strength
        }));

        return {
            health,
            armor,
            ammo,
            inventory: [], // Todo
            damageIndicators,
            fps,
            pickupIcon: lastRendered.pickupIcon
        };
    },

    getStatusBar(): StatusBarData | null {
        if (!lastRendered) return null;
        return {
            health: lastRendered.health ?? 0,
            armor: lastRendered.armor ?? 0,
            ammo: lastRendered.ammo ?? 0,
            selectedAmmoIndex: 0
        };
    },

    getCrosshairInfo(): CrosshairInfo {
        return {
            index: 0,
            name: 'default'
        };
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
        demoControls.setDemoName(filename);
        isDemoPlaying = true;
        currentDemoName = filename;
        clientMode = ClientMode.DemoPlayback;
        lastRenderTime = 0;
        // Reset state
        configStrings.clear(); // Clear existing configstrings
    },
    stopDemoPlayback() {
        demoPlayback.stop();
        demoControls.setDemoName(null);
        isDemoPlaying = false;
        currentDemoName = null;
        clientMode = ClientMode.Normal;
        // Clean up
    },
    startRecording(filename: string) {
        if (multiplayer.isConnected()) {
             demoRecorder.startRecording(filename);
             console.log(`Recording started: ${filename}`);
        } else {
             console.log("Not connected to a server.");
        }
    },
    stopRecording() {
        if (demoRecorder.getIsRecording()) {
             const data = demoRecorder.stopRecording();
             console.log(`Recording stopped. Size: ${data?.length} bytes.`);
             // Auto-save to VFS or download?
             // For now, let's offer download if in browser
             if (data && typeof document !== 'undefined') {
                 const blob = new Blob([data as any], { type: 'application/octet-stream' });
                 const url = URL.createObjectURL(blob);
                 const a = document.createElement('a');
                 a.href = url;
                 a.download = 'demo.dm2'; // Should use filename
                 document.body.appendChild(a);
                 a.click();
                 document.body.removeChild(a);
                 URL.revokeObjectURL(url);
             }
        }
    },
    ParseCenterPrint(msg: string) {
      cg.ParseCenterPrint(msg, 0, false);

      if (clientExports.onCenterPrint) {
        // Default duration 3 seconds for now
        clientExports.onCenterPrint(msg, 3.0);
      }

      // Simple heuristic for pickup messages
      // "You got the <item>"
      if (msg.startsWith('You got the ')) {
        const item = msg.substring(12).replace('.', '');
        if (clientExports.onPickupMessage) {
            clientExports.onPickupMessage(item);
        }
      }
    },
    ParseNotify(msg: string) {
      cg.NotifyMessage(0, msg, false);

      if (clientExports.onNotify) {
        clientExports.onNotify(msg);
      }

      if (clientExports.onObituaryMessage) {
         if (!msg.includes(': ')) {
             clientExports.onObituaryMessage(msg);
         }
      }
    },
    showSubtitle(text: string, soundName: string) {
      cg.ShowSubtitle(text, soundName);
    },
    ParseConfigString(index: number, value: string) {
      configStrings.set(index, value);
      cg.ParseConfigString(index, value);

      // Handle CD Track
      if (index === ConfigStringIndex.CdTrack) {
          processCdTrack(value);
      }
    },
    demoHandler,
    multiplayer,
    configStrings,

    // Demo Camera API
    setDemoCameraMode(mode: DemoCameraMode) {
        demoCameraState.mode = mode;
    },
    setDemoThirdPersonDistance(dist: number) {
        demoCameraState.thirdPersonDistance = dist;
    },
    setDemoThirdPersonOffset(offset: Vec3) {
        demoCameraState.thirdPersonOffset = offset;
    },
    setDemoFreeCamera(origin: Vec3, angles: Vec3) {
        demoCameraState.freeCameraOrigin = origin;
        demoCameraState.freeCameraAngles = angles;
    },
    setDemoFollowEntity(entityId: number) {
        demoCameraState.followEntityId = entityId;
    },

    // Spectator API
    setSpectatorTarget(targetEntityId: number | null) {
        if (targetEntityId === null) {
            if (demoCameraState.mode === DemoCameraMode.Follow) {
                demoCameraState.mode = DemoCameraMode.Free;
            }
            demoCameraState.followEntityId = -1;
        } else {
            demoCameraState.mode = DemoCameraMode.Follow;
            demoCameraState.followEntityId = targetEntityId;
        }
    },

    getSpectatorTargets(): { id: number; name: string }[] {
        const targets: { id: number; name: string }[] = [];
        for (let i = 0; i < MAX_CLIENTS; i++) {
            const name = configStrings.getPlayerName(i);
            if (name) {
                const entityId = i + 1;
                targets.push({ id: entityId, name });
            }
        }
        return targets;
    },

    // Scoreboard API
    getScoreboard() {
      return scoreboardManager.getScoreboard();
    },

    // Chat API
    sendChatMessage(message: string, team: boolean = false) {
        chatManager.sendChatMessage(message, team);
    },
    getChatHistory() {
        return chatManager.getHistory();
    },

    registerLod(baseModel: string, lods: LodModel[]) {
        lodRegistry.register(baseModel, lods);
    }
  };

  // Hook up scoreboard listener
  scoreboardManager.addListener((data) => {
    if (clientExports.onScoreboardUpdate) {
      clientExports.onScoreboardUpdate(data);
    }
  });

  // Hook up chat listener
  chatManager.addListener((sender, message, team) => {
      if (clientExports.onChatMessage) {
          clientExports.onChatMessage(sender, message, team);
      }
  });

  return clientExports;
}
