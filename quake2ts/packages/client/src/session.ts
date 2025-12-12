import { ClientExports, createClient, ClientImports } from './index.js';
import { createGame, GameExports, GameSaveFile, GameCreateOptions, GameEngine, SaveStorage } from '@quake2ts/game';
import { EngineImports, Renderer, EngineHost, TraceResult } from '@quake2ts/engine';
import { UserCommand, Vec3, CollisionPlane } from '@quake2ts/shared';
import { InputController, InputBindings } from './input/controller.js';
// We need to import InputBindings class but it is not exported from controller.
// It is exported from bindings.js which is re-exported from index.js
import { InputBindings as InputBindingsClass } from './input/bindings.js';
import { MenuSystem } from './ui/menu/system.js';

export interface HudData {
    health: number;
    armor: number;
    ammo: number;
    weaponIcon: string;
    ammoIcon: string;
    armorIcon: string;
    pickupIcon: string;
    inventory: any[]; // Placeholder
}

export interface StatusBarData {
    // Classic status bar fields
    health: number;
    ammo: number;
    armor: number;
    ammoIcon?: string;
    armorIcon?: string;
    weaponIcon?: string;
    selectedInventoryItem?: number;
}

export interface CrosshairInfo {
    active: boolean;
    name?: string; // Entity name if pointing at one
}

export interface SessionOptions {
  mapName?: string;
  skill?: number;
  renderMode?: string;
  audioEnabled?: boolean;
  engine: EngineImports & { renderer: Renderer; cmd?: { executeText(text: string): void } };
  storage?: SaveStorage;
}

export interface SaveMetadata {
    timestamp: number;
    mapName: string;
    difficulty: number;
    playtime: number;
    screenshot?: string; // Base64 or URL
}

export class GameSession {
  private client: ClientExports | null = null;
  private game: GameExports | null = null;
  private engine: EngineImports & { renderer: Renderer; cmd?: { executeText(text: string): void } };
  private host: EngineHost | null = null;
  private options: SessionOptions;

  // Event handlers
  public onInputCommand?: (cmd: UserCommand) => void;

  // 4.2.1 HUD Events
  public onHudUpdate?: (data: HudData) => void;

  // 4.2.2 Message Events
  public onCenterPrint?: (message: string, duration: number) => void;
  public onNotify?: (message: string) => void;
  public onPickupMessage?: (item: string) => void;
  public onObituaryMessage?: (message: string) => void;

  // 4.2.3 Menu Events
  public onMenuStateChange?: (active: boolean) => void;

  constructor(options: SessionOptions) {
    this.options = options;
    this.engine = options.engine;
  }

  public getInputController(): InputController {
      if (!this.client) {
          throw new Error("Client not initialized. Start a game first.");
      }
      return this.client.input;
  }

  public bindInputSource(source: any): void {
      // InputController currently polls sources or receives events.
      // If source is a DOM element or similar, we might need to hook up event listeners.
      // The current InputController architecture seems to handle events via handleKeyDown/Up etc.
      // and polling gamepads via getGamepads option.

      // If the intent is to register a new source (like a new gamepad or custom input device),
      // we might need to extend InputController.

      // For now, based on the InputController implementation:
      // It has handleKeyDown, handleKeyUp, handleMouseButtonDown, etc.
      // It doesn't have a generic bindInputSource method.

      // We will assume for this task that we just need to expose the mechanism.
      // Since InputController is exposed, the caller can call handle* methods on it.

      console.warn("bindInputSource not fully implemented: use getInputController() and call handle* methods.");
  }

  public setKeyBinding(action: string, keys: string[]): void {
      if (!this.client) return;

      // Clear existing bindings for this action if needed, or just add.
      // InputBindings.bind(code, command)
      // We need to map keys (codes) to action (command).

      // First, find all bindings for this action and unbind them if we want to replace?
      // The requirement "setKeyBinding" implies replacing or setting.

      for (const key of keys) {
          this.client.bindings.bind(key, action);
      }
  }

  public getDefaultBindings(): InputBindingsClass {
      // Returns the current bindings if client is active, or new default ones.
      if (this.client) {
          return this.client.bindings;
      }
      // If no client, return a new default set
      // We need to import createDefaultBindings
      return new InputBindingsClass();
  }

  public getPlayerState(): PlayerState | undefined {
      if (!this.client || !this.client.lastRendered) return undefined;
      // Map PredictionState to PlayerState roughly or expose compatible fields
      // PredictionState has most fields.
      // But we need to cast or adapt.
      return this.client.lastRendered as unknown as PlayerState;
  }

  public getGameTime(): number {
      if (this.game) {
          return this.game.time;
      }
      if (this.client && this.client.lastRendered) {
          // Fallback to client state if game access is limited (e.g. networked)
          // But here game is local.
      }
      return 0;
  }

  public isPaused(): boolean {
      return this.host ? this.host.paused : false;
  }

  public getSkillLevel(): number {
      if (this.host && this.host.cvars) {
          return this.host.cvars.get('skill')?.number ?? 0;
      }
      return this.options.skill ?? 0;
  }

  public getMapName(): string {
      // Map name is not easily stored unless we track it
      // or read from 'mapname' cvar if it exists
      if (this.host && this.host.cvars) {
          const mapname = this.host.cvars.get('mapname');
          if (mapname) return mapname.string;
      }
      return this.options.mapName ?? '';
  }

  public getGameMode(): string {
      if (this.host && this.host.cvars) {
          const deathmatch = this.host.cvars.get('deathmatch')?.number ?? 0;
          const coop = this.host.cvars.get('coop')?.number ?? 0;
          if (deathmatch) return 'deathmatch';
          if (coop) return 'coop';
      }
      return 'single';
  }

  public getHudData(): HudData {
      if (!this.client || !this.client.lastRendered) {
          return { health: 0, armor: 0, ammo: 0, weaponIcon: '', ammoIcon: '', armorIcon: '', pickupIcon: '', inventory: [] };
      }
      const state = this.client.lastRendered;
      // Map state to HUD data
      // Icons need configstring lookup
      // Assuming state has stats array like Q2

      // Need PlayerStat enum or similar
      // STAT_HEALTH = 0, STAT_AMMO = 2, STAT_ARMOR = 4

      const health = state.health ?? 0;
      const ammo = state.ammo ?? 0;
      const armor = state.armor ?? 0;

      // Icons need to be resolved via configStrings from ClientExports
      // But we don't have easy access to configstring index logic here unless we duplicate it
      // or expose helper from client.

      return {
          health,
          armor,
          ammo,
          weaponIcon: '', // TODO: Resolve icon
          ammoIcon: '',
          armorIcon: '',
          pickupIcon: '', // state.pickupIcon?
          inventory: []
      };
  }

  public getStatusBar(): StatusBarData {
      const hud = this.getHudData();
      return {
          health: hud.health,
          ammo: hud.ammo,
          armor: hud.armor
      };
  }

  public getCrosshairInfo(): CrosshairInfo {
      // Raycast from camera?
      return { active: true };
  }

  public showPauseMenu(): void {
      if (!this.client) return;
      if (!this.client.menuSystem.isActive()) {
          this.client.toggleMenu();
      }
  }

  public hidePauseMenu(): void {
      if (!this.client) return;
      if (this.client.menuSystem.isActive()) {
          this.client.toggleMenu();
      }
  }

  public isMenuActive(): boolean {
      return this.client ? this.client.menuSystem.isActive() : false;
  }

  public getMenuSystem(): MenuSystem | undefined {
      return this.client?.menuSystem;
  }

  public async saveGame(slotName: string): Promise<GameSaveFile> {
      if (!this.game) {
          throw new Error("Game not running");
      }

      // Get current map name and skill
      const mapName = this.getMapName();
      const skill = this.getSkillLevel();
      const time = this.getGameTime();

      // Create save object
      const saveData = this.game.createSave(mapName, skill, time);

      // Persist if storage available
      if (this.options.storage) {
          await this.options.storage.save(slotName, saveData);
      }

      return saveData;
  }

  public getSaveMetadata(saveData: GameSaveFile): SaveMetadata {
      // Assuming metadata is embedded or we extract from SaveFile properties
      // GameSaveFile in @quake2ts/game/src/save/index.ts has timestamp, map, etc.
      // Let's verify properties.
      // Looking at `createSave` usage in `gameExports`:
      // createSaveFile({ map, difficulty, playtimeSeconds ... })
      // It returns GameSaveFile.

      return {
          timestamp: saveData.timestamp,
          mapName: saveData.map,
          difficulty: saveData.difficulty,
          playtime: saveData.playtimeSeconds
      };
  }

  public async loadGame(saveData: GameSaveFile): Promise<void> {
      // Logic from loadSavedGame but async and renamed
      this.loadSavedGame(saveData);
      return Promise.resolve();
  }

  public async quickSave(): Promise<void> {
      await this.saveGame('quick');
  }

  public async quickLoad(): Promise<void> {
      if (!this.options.storage) {
          throw new Error("No storage configured for quick load");
      }
      const save = await this.options.storage.load('quick');
      if (!save) {
          throw new Error("No quick save found");
      }
      await this.loadGame(save);
  }

  public async hasQuickSave(): Promise<boolean> {
      if (!this.options.storage) return false;
      const list = await this.options.storage.list();
      return list.some(s => s.name === 'quick');
  }

  public startNewGame(mapName: string, skill: number = 1): void {
    if (this.host) {
      this.shutdown();
    }

    // Update options
    this.options.mapName = mapName;
    this.options.skill = skill;

    const gameOptions: GameCreateOptions = {
      gravity: { x: 0, y: 0, z: -800 }, // Default gravity
      skill: skill,
      deathmatch: false, // Single player default
      coop: false
    };

    const gameEngineAdapter: GameEngine = {
       trace: (start: Vec3, end: Vec3) => {
         return this.engine.trace(start, end);
       },
       centerprintf: (ent, msg) => {
         if (this.client) {
             this.client.ParseCenterPrint(msg);
         }
       },
       configstring: (idx, val) => {
          if (this.client) {
            this.client.ParseConfigString(idx, val);
          }
       },
       multicast: () => {},
       unicast: () => {},
       serverCommand: () => {},
    };

    const gameImports = {
        trace: (start: Vec3, mins: Vec3 | null, maxs: Vec3 | null, end: Vec3, passent: any, contentmask: number) => {
            const tr = this.engine.trace(start, end, mins || undefined, maxs || undefined);

            // Map Engine TraceResult to Game GameTraceResult
            // PmoveTraceResult doesn't have plane (CollisionPlane) or ent (Entity).
            // It has planeNormal.

            let plane: CollisionPlane | null = null;
            if (tr.planeNormal) {
                // If the engine returns a plane normal, we can construct a partial plane.
                // Distance is missing, which might be critical for some physics.
                // However, engine.trace likely returns a plane object if it's a full trace implementation.
                // But types say PmoveTraceResult.

                // If type definition is strictly PmoveTraceResult, we only have planeNormal.
                plane = {
                    normal: tr.planeNormal,
                    dist: 0, // Unknown distance
                    type: 0, // Unknown type
                    signbits: 0, // Unknown
                };
            }

            return {
                allsolid: tr.allsolid,
                startsolid: tr.startsolid,
                fraction: tr.fraction,
                endpos: tr.endpos,
                plane: plane,
                surfaceFlags: tr.surfaceFlags ?? 0,
                contents: tr.contents ?? 0,
                ent: null // Engine trace does not return Entity
            };
        },
        pointcontents: (p: Vec3) => {
             const t = this.engine.trace(p, p, undefined, undefined);
             return t.contents || 0;
        },
        multicast: () => {},
        unicast: () => {},
        configstring: (idx: number, val: string) => {
             if (this.client) {
                 this.client.ParseConfigString(idx, val);
             }
        },
        serverCommand: (cmd: string) => {}
    };

    this.game = createGame(gameImports, gameEngineAdapter, gameOptions);

      let lastMenuActive = false;

    const clientProxy: any = {
        init: (initial: any) => this.client?.init(initial),
          render: (sample: any) => {
              if (!this.client) return null;
              const cmd = this.client.render(sample);
              if (this.onInputCommand) {
                  this.onInputCommand(cmd);
              }

              // Trigger HUD Update
              if (this.onHudUpdate) {
                  this.onHudUpdate(this.getHudData());
              }

              // Monitor Menu State
              const menuActive = this.isMenuActive();
              if (menuActive !== lastMenuActive) {
                  lastMenuActive = menuActive;
                  if (this.onMenuStateChange) {
                      this.onMenuStateChange(menuActive);
                  }
              }

              return cmd;
          },
        shutdown: () => this.client?.shutdown(),
        get camera() { return this.client?.camera; }
    };

    this.host = new EngineHost(this.game, clientProxy);

    const clientImports: ClientImports = {
        engine: this.engine,
        host: this.host
    };

    this.client = createClient(clientImports);

      // Hook up events
      this.client.onCenterPrint = (msg, dur) => this.onCenterPrint?.(msg, dur);
      this.client.onNotify = (msg) => this.onNotify?.(msg);
      // TODO: Hook menu state change if MenuSystem supports it (it might not emit events yet)

    this.game.spawnWorld();

    this.host.start();

    // Set cvars
    if (this.host.cvars) {
        if (!this.host.cvars.get('skill')) {
             this.host.cvars.register({ name: 'skill', defaultValue: '1' });
        }
        this.host.cvars.setValue('skill', skill.toString());

        if (!this.host.cvars.get('mapname')) {
             this.host.cvars.register({ name: 'mapname', defaultValue: '' });
        }
        this.host.cvars.setValue('mapname', mapName);
    }

    // Trigger map load if command is available
    if (this.engine.cmd) {
         this.engine.cmd.executeText(`map ${mapName}`);
    } else if (this.host.commands) {
         // Fallback to host commands if engine cmd not directly exposed (though session assumes it)
         this.host.commands.execute(`map ${mapName}`);
    }
  }

  public loadSavedGame(saveData: GameSaveFile): void {
     if (this.host) {
         this.shutdown();
     }

     // Reuse startNewGame logic but without executing 'map' command initially,
     // or rather, we need to initialize the game with the map from the save file.
     // However, loading the save overwrites the state anyway.
     // But we need the map loaded in the engine.

     const mapName = saveData.map;
     // Skill is in saveData too but startNewGame takes it.
     const skill = saveData.difficulty;

     // Initialize game session similar to startNewGame
     // Duplicate code for now, can be refactored.
     const gameOptions: GameCreateOptions = {
        gravity: { x: 0, y: 0, z: -800 },
        skill: skill,
        deathmatch: false,
        coop: false
     };

     const gameEngineAdapter: GameEngine = {
         trace: (start: Vec3, end: Vec3) => {
           return this.engine.trace(start, end);
         },
         centerprintf: (ent, msg) => {
           if (this.client) {
               this.client.ParseCenterPrint(msg);
           }
         },
         configstring: (idx, val) => {
            if (this.client) {
              this.client.ParseConfigString(idx, val);
            }
         },
         multicast: () => {},
         unicast: () => {},
         serverCommand: () => {},
      };

      const gameImports = {
          trace: (start: Vec3, mins: Vec3 | null, maxs: Vec3 | null, end: Vec3, passent: any, contentmask: number) => {
              const tr = this.engine.trace(start, end, mins || undefined, maxs || undefined);
              let plane: CollisionPlane | null = null;
              if (tr.planeNormal) {
                  plane = {
                      normal: tr.planeNormal,
                      dist: 0,
                      type: 0,
                      signbits: 0,
                  };
              }
              return {
                  allsolid: tr.allsolid,
                  startsolid: tr.startsolid,
                  fraction: tr.fraction,
                  endpos: tr.endpos,
                  plane: plane,
                  surfaceFlags: tr.surfaceFlags ?? 0,
                  contents: tr.contents ?? 0,
                  ent: null
              };
          },
          pointcontents: (p: Vec3) => {
               const t = this.engine.trace(p, p, undefined, undefined);
               return t.contents || 0;
          },
          multicast: () => {},
          unicast: () => {},
          configstring: (idx: number, val: string) => {
               if (this.client) {
                   this.client.ParseConfigString(idx, val);
               }
          },
          serverCommand: (cmd: string) => {}
      };

      this.game = createGame(gameImports, gameEngineAdapter, gameOptions);

      let lastMenuActive = false;

      const clientProxy: any = {
          init: (initial: any) => this.client?.init(initial),
          render: (sample: any) => {
              if (!this.client) return {
                  msec: 0,
                  buttons: 0,
                  angles: { x: 0, y: 0, z: 0 },
                  forwardmove: 0,
                  sidemove: 0,
                  upmove: 0,
                  serverFrame: 0,
                  sequence: 0,
                  lightlevel: 0,
                  impulse: 0
              };
              const cmd = this.client.render(sample);
              if (this.onInputCommand) {
                  this.onInputCommand(cmd);
              }

              // Trigger HUD Update
              if (this.onHudUpdate) {
                  this.onHudUpdate(this.getHudData());
              }

              // Monitor Menu State
              const menuActive = this.isMenuActive();
              if (menuActive !== lastMenuActive) {
                  lastMenuActive = menuActive;
                  if (this.onMenuStateChange) {
                      this.onMenuStateChange(menuActive);
                  }
              }

              return cmd;
          },
          shutdown: () => this.client?.shutdown(),
          get camera() { return this.client?.camera; }
      };

      this.host = new EngineHost(this.game, clientProxy);

      const clientImports: ClientImports = {
          engine: this.engine,
          host: this.host
      };

      this.client = createClient(clientImports);

      // We need to load the map first so the engine has the collision model etc.
      if (this.engine.cmd) {
           this.engine.cmd.executeText(`map ${mapName}`);
      } else if (this.host.commands) {
           this.host.commands.execute(`map ${mapName}`);
      }

      // Now load the save data into the game
      if (this.game) {
          this.game.loadSave(saveData);
      }

      this.host.start();
  }

  public shutdown(): void {
    if (this.host) {
        this.host.stop();
        this.host = null;
    }
    if (this.client) {
        this.client.shutdown();
        this.client = null;
    }
    this.game = null;
  }

  public getClient(): ClientExports | null {
      return this.client;
  }

  public getGame(): GameExports | null {
      return this.game;
  }

  public getHost(): EngineHost | null {
      return this.host;
  }
}

export function createSession(options: SessionOptions): GameSession {
  return new GameSession(options);
}
