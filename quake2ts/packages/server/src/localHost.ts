/**
 * One in-process host for single player: the `map` command, the collision world and the
 * game module, with no network in between. This is the piece the old code never had, so
 * nothing loaded a map's entities or put a player into it outside tests.
 *
 * It follows the original server's map start (SV_SpawnServer): load the BSP's collision
 * model, reset the world, register "*N" submodels as the first models after the world,
 * spawn the entity lump, then let the player in.
 */
import { collisionModelFromBsp, parseBsp, type BspMap } from '@quake2ts/engine';
import type { CollisionModel, UserCommand, Vec3 } from '@quake2ts/shared';
import { inPHS } from '@quake2ts/shared';
import {
  createGame,
  spawnEntitiesFromText,
  type Entity,
  type GameExports,
  type GameImports,
  type GameStateSnapshot,
} from '@quake2ts/game';
import type { GameFrameResult } from '@quake2ts/engine';
import { AreaType, World } from './world.js';

/** Game frames run at 40 Hz, as the rerelease does. */
export const FRAME_MSEC = 25;

export interface LocalHostOptions {
  /** Reads a game file (for example "maps/demo1.bsp") from the mounted paks, or undefined if absent. */
  readonly readFile: (path: string) => Uint8Array | undefined;
  readonly skill?: number;
  readonly onWarning?: (message: string) => void;
}

export interface LoadedMap {
  readonly name: string;
  readonly bsp: BspMap;
  readonly model: CollisionModel;
  readonly world: World<Entity>;
  readonly game: GameExports;
  /** How many entities the entity lump spawned (the world included). */
  readonly spawned: number;
}

const toArrayBuffer = (bytes: Uint8Array): ArrayBuffer =>
  bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;

export class LocalHost {
  private current: LoadedMap | null = null;
  private frameNumber = 0;
  private timeMs = 0;
  private readonly configstrings = new Map<number, string>();
  /** Model names by index; index 1 is the world, then the submodels, as SV_SpawnServer lays them out. */
  private models: string[] = [];
  private sounds: string[] = [];
  /** Commands the game sent to the server (gi.AddCommandString), such as `changelevel demo2`. */
  readonly serverCommands: string[] = [];

  constructor(private readonly options: LocalHostOptions) {}

  get map(): LoadedMap {
    if (!this.current) throw new Error('No map loaded; run the map command first');
    return this.current;
  }

  /** Level time in seconds. */
  get timeSeconds(): number {
    return this.timeMs / 1000;
  }

  get loaded(): boolean {
    return this.current !== null;
  }

  /** The single-player player entity (client slot 1), once the map is up. */
  get player(): Entity | undefined {
    return this.current?.game.entities.find((e) => e.classname === 'player');
  }

  /** Console commands. Only `map <name>` for now. */
  command(line: string): void {
    const [cmd, ...args] = line.trim().split(/\s+/);
    if (cmd === 'map') {
      if (!args[0]) throw new Error('usage: map <mapname>');
      this.loadMap(args[0]);
      return;
    }
    throw new Error(`Unknown command: ${cmd}`);
  }

  /** SV_SpawnServer for a single-player game. */
  loadMap(name: string): LoadedMap {
    this.current?.game.shutdown();
    this.current = null;

    const path = `maps/${name}.bsp`;
    const bytes = this.options.readFile(path);
    if (!bytes) throw new Error(`Map not found: ${path}`);
    const bsp = parseBsp(toArrayBuffer(bytes));
    const model = collisionModelFromBsp(bsp);

    this.configstrings.clear();
    this.models = ['', path];
    for (let i = 1; i < model.bmodels.length; i++) this.models.push(`*${i}`);
    this.sounds = [''];
    this.serverCommands.length = 0;
    this.frameNumber = 0;
    this.timeMs = 0;

    let game: GameExports | null = null;
    const world = new World<Entity>({
      model,
      submodelHeadnode: (modelindex) => {
        const name = this.models[modelindex];
        return name?.startsWith('*') ? model.bmodels[Number(name.slice(1))]?.headnode : undefined;
      },
    });

    const imports: Partial<GameImports> = {
      trace: (start, mins, maxs, end, passent, contentmask) => {
        const t = world.trace(start, mins, maxs, end, passent, contentmask);
        return { ...t, surfaceFlags: t.surfaceFlags ?? 0, contents: t.contents ?? 0 };
      },
      pointcontents: (p) => world.pointContents(p),
      inPHS: (p1, p2) => inPHS(p1, p2, model),
      linkentity: (ent) => world.link(ent),
      unlinkentity: (ent) => world.unlink(ent),
      setmodel: (ent, modelName) => {
        ent.modelindex = this.modelIndex(modelName);
        if (modelName.startsWith('*')) {
          const sub = model.bmodels[Number(modelName.slice(1))];
          if (!sub) throw new Error(`setmodel: no submodel ${modelName}`);
          ent.mins = { ...sub.mins };
          ent.maxs = { ...sub.maxs };
        }
      },
      // The game's findInBox wants every non-Solid.Not entity, triggers included.
      areaEdicts: (mins, maxs) =>
        [...world.areaEdicts(mins, maxs, AreaType.Solid), ...world.areaEdicts(mins, maxs, AreaType.Triggers)].map((e) => e.index),
      configstring: (index, value) => this.configstrings.set(index, value),
      serverCommand: (cmd) => {
        this.serverCommands.push(cmd.trim());
      },
    };

    game = createGame(
      imports,
      {
        trace: () => undefined,
        modelIndex: (n) => this.modelIndex(n),
        soundIndex: (n) => this.soundIndex(n),
        configstring: (index, value) => this.configstrings.set(index, value),
      },
      { gravity: { x: 0, y: 0, z: -800 }, deathmatch: false, skill: this.options.skill ?? 1 },
    );
    // Single player: maxclients 1, so the player is edict 1 and map entities follow it.
    game.entities.reserveClientSlots(1);
    game.init(0);
    world.setWorldEntity(game.entities.world);

    const spawned = spawnEntitiesFromText(bsp.entities.raw, {
      registry: { get: (classname: string) => game!.entities.getSpawnFunction(classname) } as never,
      entities: game.entities,
      onWarning: this.options.onWarning,
    });

    // Single player: spawnWorld puts the player at info_player_start.
    game.spawnWorld();

    this.current = { name, bsp, model, world, game, spawned: spawned.length };
    return this.current;
  }

  modelIndex(name: string): number {
    let i = this.models.indexOf(name);
    if (i < 0) {
      i = this.models.length;
      this.models.push(name);
    }
    return i;
  }

  /** The model name at an index ("maps/demo1.bsp", "*3", "models/monsters/soldier/tris.md2"), as CS_MODELS holds it. */
  modelName(index: number): string | undefined {
    return this.models[index] || undefined;
  }

  soundIndex(name: string): number {
    let i = this.sounds.indexOf(name);
    if (i < 0) {
      i = this.sounds.length;
      this.sounds.push(name);
    }
    return i;
  }

  configstring(index: number): string | undefined {
    return this.configstrings.get(index);
  }

  /** Runs one 25 ms game frame. With no cmd the player still moves, with neutral input, as a connected client always sends one. */
  frame(cmd?: Partial<UserCommand>): GameFrameResult<GameStateSnapshot> {
    const { game } = this.map;
    this.frameNumber += 1;
    this.timeMs += FRAME_MSEC;
    const command = {
      msec: FRAME_MSEC,
      buttons: 0,
      angles: this.player?.client?.v_angle ?? { x: 0, y: 0, z: 0 },
      forwardmove: 0,
      sidemove: 0,
      upmove: 0,
      ...cmd,
    } as UserCommand;
    return game.frame({ frame: this.frameNumber, deltaMs: FRAME_MSEC, nowMs: this.timeMs }, command);
  }

  /** Runs frames for a span of game time. */
  run(seconds: number, cmd?: Partial<UserCommand>): void {
    const frames = Math.round((seconds * 1000) / FRAME_MSEC);
    for (let i = 0; i < frames; i++) this.frame(cmd);
  }

  /** Where the player's feet are: origin plus mins.z. */
  playerFeet(): Vec3 | undefined {
    const p = this.player;
    return p ? { x: p.origin.x, y: p.origin.y, z: p.origin.z + p.mins.z } : undefined;
  }
}
