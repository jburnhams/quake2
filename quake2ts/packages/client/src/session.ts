import { ClientExports, createClient, ClientImports, InputController, InputSource, InputBindings, HudData, StatusBarData, CrosshairInfo } from './index.js';
import { MenuState } from './ui/menu/types.js';
import { createGame, GameExports, GameSaveFile, GameCreateOptions, GameEngine } from '@quake2ts/game';
import { EngineImports, Renderer, EngineHost, TraceResult } from '@quake2ts/engine';
import { UserCommand, Vec3, CollisionPlane, PlayerState } from '@quake2ts/shared';

export interface SessionOptions {
  mapName?: string;
  skill?: number;
  renderMode?: string;
  audioEnabled?: boolean;
  engine: EngineImports & { renderer: Renderer; cmd?: { executeText(text: string): void } };
}

export class GameSession {
  private client: ClientExports | null = null;
  private game: GameExports | null = null;
  private engine: EngineImports & { renderer: Renderer; cmd?: { executeText(text: string): void } };
  private host: EngineHost | null = null;
  private options: SessionOptions;
  private currentMapName: string = '';
  private inputController: InputController;
  private _onInputCommand?: (cmd: UserCommand) => void;
  private _onHudUpdate?: (data: HudData) => void;
  private _onCenterPrint?: (message: string, duration: number) => void;
  private _onNotify?: (message: string) => void;
  private _onPickupMessage?: (item: string) => void;
  private _onObituaryMessage?: (message: string) => void;
  private _onMenuStateChange?: (active: boolean) => void;

  constructor(options: SessionOptions) {
    this.options = options;
    this.engine = options.engine;
    this.inputController = new InputController();
  }

  public startNewGame(mapName: string, skill: number = 1): void {
    if (this.host) {
      this.shutdown();
    }

    this.currentMapName = mapName;

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

    const clientProxy: any = {
        init: (initial: any) => this.client?.init(initial),
        render: (sample: any) => this.client?.render(sample),
        shutdown: () => this.client?.shutdown(),
        get camera() { return this.client?.camera; }
    };

    this.host = new EngineHost(this.game, clientProxy);

    const clientImports: ClientImports = {
        engine: this.engine,
        host: this.host,
        inputController: this.inputController
    };

    this.client = createClient(clientImports);
    if (this._onInputCommand) {
        this.client.onInputCommand = this._onInputCommand;
    }
    if (this._onHudUpdate) {
        this.client.onHudUpdate = this._onHudUpdate;
    }
      this.client.onCenterPrint = this._onCenterPrint;
      this.client.onNotify = this._onNotify;
      this.client.onPickupMessage = this._onPickupMessage;
      this.client.onObituaryMessage = this._onObituaryMessage;
      this.client.onMenuStateChange = this._onMenuStateChange;

    this.game.spawnWorld();

    this.host.start();

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

     const mapName = saveData.map;
     this.currentMapName = mapName;
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

      const clientProxy: any = {
          init: (initial: any) => this.client?.init(initial),
          render: (sample: any) => this.client?.render(sample),
          shutdown: () => this.client?.shutdown(),
          get camera() { return this.client?.camera; }
      };

      this.host = new EngineHost(this.game, clientProxy);

      const clientImports: ClientImports = {
          engine: this.engine,
          host: this.host,
          inputController: this.inputController
      };

      this.client = createClient(clientImports);
      if (this._onInputCommand) {
          this.client.onInputCommand = this._onInputCommand;
      }
      if (this._onHudUpdate) {
          this.client.onHudUpdate = this._onHudUpdate;
      }
      this.client.onCenterPrint = this._onCenterPrint;
      this.client.onNotify = this._onNotify;
      this.client.onPickupMessage = this._onPickupMessage;
      this.client.onObituaryMessage = this._onObituaryMessage;
      this.client.onMenuStateChange = this._onMenuStateChange;

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

  public bindInputSource(source: InputSource): void {
      this.inputController.bindInputSource(source);
  }

  public setKeyBinding(action: string, keys: string[]): void {
      this.inputController.setKeyBinding(action, keys);
  }

  public getDefaultBindings(): InputBindings {
      return this.inputController.getDefaultBindings();
  }

  public set onInputCommand(handler: ((cmd: UserCommand) => void) | undefined) {
      this._onInputCommand = handler;
      if (this.client) {
          this.client.onInputCommand = handler;
      }
  }

  public get onInputCommand(): ((cmd: UserCommand) => void) | undefined {
      return this._onInputCommand;
  }

  // Section 4.2: HUD and UI Integration
  public getHudData(): HudData | null {
      return this.client?.getHudData() ?? null;
  }

  public getStatusBar(): StatusBarData | null {
      return this.client?.getStatusBar() ?? null;
  }

  public getCrosshairInfo(): CrosshairInfo | null {
      return this.client?.getCrosshairInfo() ?? null;
  }

  public set onHudUpdate(handler: ((data: HudData) => void) | undefined) {
      this._onHudUpdate = handler;
      if (this.client) {
          this.client.onHudUpdate = handler;
      }
  }

  public get onHudUpdate(): ((data: HudData) => void) | undefined {
      return this._onHudUpdate;
  }

  public set onCenterPrint(handler: ((message: string, duration: number) => void) | undefined) {
      this._onCenterPrint = handler;
      if (this.client) {
          this.client.onCenterPrint = handler;
      }
  }

  public get onCenterPrint(): ((message: string, duration: number) => void) | undefined {
      return this._onCenterPrint;
  }

  public set onNotify(handler: ((message: string) => void) | undefined) {
      this._onNotify = handler;
      if (this.client) {
          this.client.onNotify = handler;
      }
  }

  public get onNotify(): ((message: string) => void) | undefined {
      return this._onNotify;
  }

  public set onPickupMessage(handler: ((item: string) => void) | undefined) {
      this._onPickupMessage = handler;
      if (this.client) {
          this.client.onPickupMessage = handler;
      }
  }

  public get onPickupMessage(): ((item: string) => void) | undefined {
      return this._onPickupMessage;
  }

  public set onObituaryMessage(handler: ((message: string) => void) | undefined) {
      this._onObituaryMessage = handler;
      if (this.client) {
          this.client.onObituaryMessage = handler;
      }
  }

  public get onObituaryMessage(): ((message: string) => void) | undefined {
      return this._onObituaryMessage;
  }

  public set onMenuStateChange(handler: ((active: boolean) => void) | undefined) {
      this._onMenuStateChange = handler;
      if (this.client) {
          this.client.onMenuStateChange = handler;
      }
  }

  public get onMenuStateChange(): ((active: boolean) => void) | undefined {
      return this._onMenuStateChange;
  }

  public showPauseMenu(): void {
      if (this.client) {
          this.client.showPauseMenu();
      }
  }

  public hidePauseMenu(): void {
      if (this.client) {
          this.client.hidePauseMenu();
      }
  }

  public isMenuActive(): boolean {
      if (this.client) {
          return this.client.isMenuActive();
      }
      return false;
  }

  public getMenuState(): MenuState | null {
      if (this.client) {
          return this.client.getMenuState();
      }
      return null;
  }

  // Section 4.1.3: Game State Queries

  public getPlayerState(): PlayerState | null {
    // If running a local game or connected, we can use client prediction state
    if (this.client && this.client.lastRendered) {
        // PredictionState is compatible with PlayerState
        return this.client.lastRendered as unknown as PlayerState;
    }
    return null;
  }

  public getGameTime(): number {
    if (this.game) {
        return this.game.time;
    }
    if (this.client && this.client.lastRendered) {
        // Fallback to client time if game instance not available (e.g. MP)
        // But getGameTime usually implies level time.
        // client.lastRendered doesn't have level time directly unless in stats.
        // Or prediction uses server time?
        // prediction state has pm_time but that's for events.
        // For now, return 0 if no local game.
        return 0;
    }
    return 0;
  }

  public isPaused(): boolean {
    if (this.host) {
        return this.host.paused;
    }
    return false;
  }

  public getSkillLevel(): number {
    if (this.game) {
        return this.game.skill;
    }
    return this.options.skill ?? 1;
  }

  public getMapName(): string {
    // Return stored map name or query game level
    if (this.game && this.game.entities && this.game.entities.level && this.game.entities.level.mapname) {
        return this.game.entities.level.mapname;
    }
    return this.currentMapName;
  }

  public getGameMode(): 'single' | 'deathmatch' | 'coop' {
    if (this.game) {
        if (this.game.deathmatch) return 'deathmatch';
        if (this.game.coop) return 'coop';
    }
    return 'single';
  }
}

export function createSession(options: SessionOptions): GameSession {
  return new GameSession(options);
}
