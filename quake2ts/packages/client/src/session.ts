import { ClientExports, createClient, ClientImports } from './index.js';
import { createGame, GameExports, GameSaveFile, GameCreateOptions, GameEngine } from '@quake2ts/game';
import { EngineImports, Renderer, EngineHost, TraceResult } from '@quake2ts/engine';
import { UserCommand, Vec3, CollisionPlane } from '@quake2ts/shared';

export interface SessionOptions {
  mapName?: string;
  skill?: number;
  audioEnabled?: boolean;
  engine: EngineImports & { renderer: Renderer; cmd?: { executeText(text: string): void } };
}

export class GameSession {
  private client: ClientExports | null = null;
  private game: GameExports | null = null;
  private engine: EngineImports & { renderer: Renderer; cmd?: { executeText(text: string): void } };
  private host: EngineHost | null = null;
  private options: SessionOptions;

  constructor(options: SessionOptions) {
    this.options = options;
    this.engine = options.engine;
  }

  public startNewGame(mapName: string, skill: number = 1): void {
    if (this.host) {
      this.shutdown();
    }

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
                    pad: [0, 0]
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
        host: this.host
    };

    this.client = createClient(clientImports);

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
     // TODO: Implement load logic
  }

  public shutdown(): void {
    if (this.host) {
        this.host.stop();
        this.host = null;
    }
    this.client = null;
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
