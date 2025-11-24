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
import { MapsMenuFactory } from './ui/menu/maps.js';
import { PauseMenuFactory } from './ui/menu/pause.js';
import { Draw_Menu } from './ui/menu/render.js';
import { InputBindings } from './input/bindings.js';

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
}

export function createClient(imports: ClientImports): ClientExports {
  const prediction = new ClientPrediction(imports.engine.trace);
  const view = new ViewEffects();
  const messageSystem = new MessageSystem();
  const demoPlayback = new DemoPlaybackController();
  const demoHandler = new ClientNetworkHandler(imports);

  // Initialize persistent Menu System
  const menuSystem = new MenuSystem();

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
    },

    predict(command: UserCommand): PredictionState {
      // If menu is active, we might want to zero out movement in the command
      // However, predict() is about physics. The input generation (which we don't control here)
      // should probably have suppressed movement keys if menu was active.
      // But we can double check.
      if (menuSystem.isActive()) {
          // command.forwardmove = 0;
          // command.sidemove = 0;
          // command.upmove = 0;
          // command.buttons = 0;
          // Note: doing this here might cause prediction errors if the server *doesn't* know menu is open.
          // But usually server doesn't know about client menus.
          // Quake 2 pauses single player when menu is open.
          // In MP, you keep moving if you hold keys.
          // Ideally, InputController handles this.
      }
      return prediction.enqueueCommand(command);
    },

    handleInput(key: string, down: boolean): boolean {
        if (!menuSystem.isActive()) return false;

        if (!down) return true; // Consume key up events if menu is active to prevent game actions

        // Map key codes to menu actions
        // This is a simple mapping. A full implementation would check bindings or use a standard UI mapping.
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
             // Let the togglemenu command handle escape if it's bound.
             // But if we are in a submenu, escape acts as 'back'.
             // The togglemenu command usually closes the *root* menu.
             // If we have depth > 1, back.
             if (menuSystem.getState().activeMenu?.parent) {
                 return menuSystem.handleInput('back');
             }
             // If at root menu, return false so the togglemenu binding (ESC) can trigger to close it.
             return false;
        } else if (key.length === 1) {
            return menuSystem.handleInput('char', key);
        } else if (key === 'Backspace') {
            return menuSystem.handleInput('left'); // Use left as backspace for now as per system.ts
        }

        return true; // Consume other keys while menu is open
    },

    toggleMenu() {
        if (menuSystem.isActive()) {
            menuSystem.closeAll();
        } else if (pauseMenuFactory) {
            menuSystem.pushMenu(pauseMenuFactory.createPauseMenu());
        }
    },

    createMainMenu(options: Omit<MainMenuOptions, 'optionsFactory' | 'mapsFactory' | 'onSetDifficulty'>, storage: SaveStorage, saveCallback: (name: string) => Promise<void>, loadCallback: (slot: string) => Promise<void>, deleteCallback: (slot: string) => Promise<void>) {
        // Reuse the client's menuSystem so we can manage it globally

        const saveLoadFactory = new SaveLoadMenuFactory(menuSystem, storage, saveCallback, loadCallback, deleteCallback);
        // Ensure optionsFactory is initialized (it might be undefined if host wasn't passed, but createMainMenu implies we have a host usually?)
        // If imports.host is missing, we create a dummy one or fail?
        // Let's create a local one if missing.
        let optsFactory = optionsFactory;
        if (!optsFactory) {
            if (!imports.host) {
                // Should potentially throw or use a dummy host, but to avoid crash:
                throw new Error('Cannot create Main Menu: EngineHost is missing');
            }
            optsFactory = new OptionsMenuFactory(menuSystem, imports.host);
        }

        // We need VFS for MapsMenuFactory.
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
        camera.aspect = 4 / 3;
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

      return command;
    },

    DrawHUD(stats: FrameRenderStats, timeMs: number) {
        // Always draw menu if active, even if no renderer (though we need renderer to draw)
        if (!imports.engine.renderer) return;

        // Draw Menu Overlay
        if (menuSystem.isActive()) {
            // Assume full screen dimensions
            Draw_Menu(imports.engine.renderer, menuSystem.getState(), imports.engine.renderer.width, imports.engine.renderer.height);
            // If menu covers screen, we might skip HUD?
            // In Q2, HUD is hidden if full screen menu? Usually yes.
            // But for Pause Menu (overlay), HUD might be visible underneath.
            // Let's draw HUD first, then Menu on top.
        }

        if (!lastRendered || !lastRendered.client) return;

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
