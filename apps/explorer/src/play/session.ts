// One single-player game in a canvas: LocalHost runs `map demo1` (the same game the walkthrough
// gate drives), the engine's WebGL renderer draws the world from where the player's eyes are, and
// the keyboard and mouse become the player's usercmd. Nothing here is React, so the loop runs at
// the display's rate without re-rendering the page.
//
// The game runs at 40 Hz in fixed 25 ms frames, as the rerelease does; the display draws whenever
// it can, so a frame of game time is run for every 25 ms of real time that has passed (capped,
// so a tab that was hidden does not fast-forward). Each frame draws the world, the brush models
// (doors and lifts where the game has moved them), every MD2 the game shows (monsters, items,
// gibs) and the weapon in the player's hands, each blended between animation frames as the original
// renderers do, and the effects the game multicast (muzzle flashes, impacts, explosions) as the
// client's effect system turns them into particles and dynamic lights. Models are loaded the first time the game names them, in the background, so one
// that appears mid-game (a gib) shows a frame or two later.
import {
  Camera,
  DynamicLightManager,
  FrameLerpTracker,
  brushModelsFromEntities,
  createRenderer,
  modelEntitiesFromEntities,
  parseBsp,
  prepareModels,
  prepareWorld,
  viewWeaponEntity,
  type FileSource,
  type Md2Model,
  type RenderableEntity,
  type SceneEntitySource,
  type Renderer,
  type WorldRenderState,
  type EngineImports,
  type EntityState,
  type DLight,
} from '@quake2ts/engine';
import { ClientEffectSystem, processEntityEffects } from '@quake2ts/client';
import { LocalHost } from '@quake2ts/server';
import { ConfigStringIndex, MAX_LIGHTSTYLES } from '@quake2ts/shared';
import { FrameStats, type FrameTimings } from './stats';

const FRAME_MS = 25;
const MAX_CATCH_UP_FRAMES = 8;
// The usercmd button bits (PlayerButton in @quake2ts/shared): BUTTON_ATTACK, BUTTON_JUMP, BUTTON_CROUCH.
const BUTTON_ATTACK = 1 << 0;
const BUTTON_JUMP = 1 << 3;
const BUTTON_CROUCH = 1 << 4;
/** Run speed, as cl_forwardspeed and cl_sidespeed are in the original (200 walking, doubled to run). */
const MOVE_SPEED = 400;
const UP_SPEED = 200;
const MOUSE_DEGREES_PER_PIXEL = 0.022 * 3; // m_pitch/m_yaw 0.022 at sensitivity 3, the original defaults.

export type InputState = { keys: ReadonlySet<string>; attack: boolean; pitch: number; yaw: number };

/**
 * The held keys and mouse as the usercmd the game reads each frame. The rerelease's pmove jumps
 * and crouches on the BUTTON_JUMP and BUTTON_CROUCH bits, not on upmove (cl_input.cpp sets both
 * from +moveup and +movedown), so a jump needs the bit; holding it jumps once, as PMF_JUMP_HELD
 * waits for the key to be let go.
 */
export function toUserCommand({ keys, attack, pitch, yaw }: InputState) {
  const held = (...codes: string[]) => codes.some((c) => keys.has(c));
  const axis = (plus: boolean, minus: boolean) => (plus ? 1 : 0) - (minus ? 1 : 0);
  const jump = held('Space');
  const crouch = held('KeyC', 'ControlLeft');
  const up = axis(jump, crouch);
  return {
    angles: { x: pitch, y: yaw, z: 0 },
    forwardmove: MOVE_SPEED * axis(held('KeyW', 'ArrowUp'), held('KeyS', 'ArrowDown')),
    sidemove: MOVE_SPEED * axis(held('KeyD'), held('KeyA')),
    upmove: UP_SPEED * up,
    buttons:
      (attack || held('ControlRight') ? BUTTON_ATTACK : 0) | (jump ? BUTTON_JUMP : 0) | (crouch ? BUTTON_CROUCH : 0),
  };
}

/** What the last frame drew and the game sent, for tests that drive the page (see `inspect`). */
export type FrameInspection = {
  /** The camera's view-projection matrix (column-major), to put a world point on the screen. */
  viewProjection: number[];
  /** The model name of every entity drawn (monsters, items, the weapon in the player's hands). */
  drawnModels: string[];
  /** Impacts and explosions the game sent since the last inspection, where they happened. */
  impacts: { type: number; pos: { x: number; y: number; z: number } }[];
  pitch: number;
  yaw: number;
};

export type PlayerStatus = { health: number; dead: boolean; map: string };

export type SessionOptions = {
  canvas: HTMLCanvasElement;
  files: FileSource;
  map?: string;
  onStatus?: (status: PlayerStatus) => void;
};

const toArrayBuffer = (bytes: Uint8Array): ArrayBuffer =>
  bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;

export class GameSession {
  private readonly keys = new Set<string>();
  private attack = false;
  private yaw = 0;
  private pitch = 0;
  private raf = 0;
  private last = 0;
  private owed = 0;
  private lastStatus = '';
  private readonly camera: Camera;
  private readonly timings = new FrameStats();
  /** MD2s loaded so far by name, and every model name already asked for. */
  private readonly models = new Map<string, Md2Model>();
  private readonly requested = new Set<string>();
  /** Blends each model from its last frame to its current one over the 100 ms animation step. */
  private readonly frameLerp = new FrameLerpTracker();
  /** Muzzle flashes, impacts and explosions, read as the client reads svc_muzzleflash and svc_temp_entity. */
  private readonly dlights = new DynamicLightManager();
  private readonly effects: ClientEffectSystem;
  private lastDrawSeconds = 0;
  private lastDrawn: RenderableEntity[] = [];
  private impactsSinceInspect: FrameInspection['impacts'] = [];
  /** The pattern last given the renderer for each style (undefined: never given). */
  private readonly lightStyles: (string | null | undefined)[] = [];

  private constructor(
    private readonly options: SessionOptions,
    private readonly gl: WebGL2RenderingContext,
    private readonly renderer: Renderer,
    private readonly world: WorldRenderState,
    private readonly host: LocalHost,
  ) {
    this.camera = new Camera(options.canvas.width, options.canvas.height);
    this.camera.fov = 90;
    // The effects read the entity that fired (its origin and angles) and spawn into the
    // renderer's particles; there is no sound yet, so no audio.
    const engine = { renderer } as unknown as EngineImports;
    this.effects = new ClientEffectSystem(this.dlights, engine, {
      getEntity: (n) => host.map.game.entities.getByIndex(n) as unknown as EntityState | undefined,
      getPlayerNum: () => (host.player?.index ?? 1) - 1,
    });
    const start = host.player?.angles;
    this.yaw = start?.y ?? 0;
  }

  /** Loads the map, prepares and uploads its world, and spawns the player. Throws an Error saying what failed. */
  static async start(options: SessionOptions): Promise<GameSession> {
    const map = options.map ?? 'demo1';
    const gl = options.canvas.getContext('webgl2', { antialias: true });
    if (!gl) throw new Error('This browser has no WebGL 2, which the game is drawn with.');
    const bspBytes = await options.files.readFile(`maps/${map}.bsp`);
    const bsp = parseBsp(toArrayBuffer(bspBytes));
    const prepared = await prepareWorld(bsp, options.files);
    const renderer = createRenderer(gl);
    const world = renderer.uploadWorld(prepared);
    const host = new LocalHost({ readFile: (path) => (path === `maps/${map}.bsp` ? bspBytes : undefined) });
    host.command(`map ${map}`);
    return new GameSession(options, gl, renderer, world, host);
  }

  /** Frame rate and CPU time over the last second, or null before two frames are drawn. */
  stats(): FrameTimings | null {
    return this.timings.read();
  }

  /** What the last frame drew and where shots landed since the last call: the end-to-end tests' view of the game. */
  inspect(): FrameInspection {
    const names = new Map<unknown, string>();
    for (const [name, model] of this.models) names.set(model, name);
    const impacts = this.impactsSinceInspect;
    this.impactsSinceInspect = [];
    return {
      viewProjection: Array.from(this.camera.viewProjectionMatrix),
      drawnModels: this.lastDrawn.map((e) => names.get(e.model) ?? '?'),
      impacts,
      pitch: this.pitch,
      yaw: this.yaw,
    };
  }

  /** Starts the loop; returns a function that stops it. */
  run(): () => void {
    const tick = (now: number) => {
      this.raf = requestAnimationFrame(tick);
      if (!this.last) this.last = now;
      this.owed = Math.min(this.owed + (now - this.last), FRAME_MS * MAX_CATCH_UP_FRAMES);
      this.last = now;
      const cpuStart = performance.now();
      while (this.owed >= FRAME_MS) {
        this.owed -= FRAME_MS;
        this.host.frame(this.command());
      }
      this.draw(now / 1000);
      this.report();
      this.timings.frame(now, performance.now() - cpuStart);
    };
    this.raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(this.raf);
  }

  /** Starts demo1 again from the beginning, as `map demo1` does. */
  restart(): void {
    this.host.command(`map ${this.options.map ?? 'demo1'}`);
    this.yaw = this.host.player?.angles.y ?? 0;
    this.pitch = 0;
  }

  key(code: string, down: boolean): void {
    if (down) this.keys.add(code);
    else this.keys.delete(code);
  }

  fire(down: boolean): void {
    this.attack = down;
  }

  look(dx: number, dy: number): void {
    this.yaw -= dx * MOUSE_DEGREES_PER_PIXEL;
    this.pitch = Math.max(-89, Math.min(89, this.pitch + dy * MOUSE_DEGREES_PER_PIXEL));
  }

  /** Lets go of every key, as when the pointer is released or the window loses focus. */
  releaseAll(): void {
    this.keys.clear();
    this.attack = false;
  }

  resize(width: number, height: number): void {
    const canvas = this.options.canvas;
    if (canvas.width === width && canvas.height === height) return;
    canvas.width = width;
    canvas.height = height;
    this.camera.setAspectRatio(width / height);
  }

  private command() {
    return toUserCommand({ keys: this.keys, attack: this.attack, pitch: this.pitch, yaw: this.yaw });
  }

  /** Starts loading any model the game has named since the last frame (CS_MODELS grows as it precaches). */
  private loadNewModels(): void {
    const names: string[] = [];
    for (let i = 1; ; i++) {
      const name = this.host.modelName(i);
      if (name === undefined) break;
      if (!this.requested.has(name) && name.endsWith('.md2')) names.push(name);
    }
    if (names.length === 0) return;
    for (const name of names) this.requested.add(name);
    prepareModels(this.options.files, names).then(
      (prepared) => {
        this.renderer.uploadModels(this.world, prepared);
        for (const [name, model] of prepared.models) this.models.set(name, model);
      },
      () => undefined, // a model that fails to load is not drawn; the game goes on
    );
  }

  private draw(timeSeconds: number): void {
    const player = this.host.player;
    const { canvas } = this.options;
    if (player) {
      this.camera.setPosition(player.origin.x, player.origin.y, player.origin.z + (player.viewheight || 22));
      const view = player.client?.v_angle ?? { x: this.pitch, y: this.yaw, z: 0 };
      this.camera.setRotation(view.x, view.y, view.z);
    }
    this.gl.viewport(0, 0, canvas.width, canvas.height);
    this.loadNewModels();
    this.syncLightStyles();
    const gameSeconds = this.host.timeSeconds;
    for (const effect of this.host.takeEffects()) {
      if (effect.kind === 'muzzleflash') this.effects.onMuzzleFlash(effect.entity, effect.weapon, gameSeconds);
      else {
        this.effects.onTempEntity(effect.type, effect.pos, gameSeconds, effect.dir, effect.pos2);
        this.impactsSinceInspect = [...this.impactsSinceInspect.slice(-31), { type: effect.type, pos: { ...effect.pos } }];
      }
    }
    const deltaTime = this.lastDrawSeconds ? Math.min(timeSeconds - this.lastDrawSeconds, 0.1) : 0;
    this.lastDrawSeconds = timeSeconds;
    this.dlights.update(gameSeconds, deltaTime);
    // Game time now, between game frames: the 25 ms frames run so far plus the time owed to the next.
    const nowMs = this.host.timeSeconds * 1000 + this.owed;
    const entities: SceneEntitySource[] = [];
    const entityLights: DLight[] = [];
    let viewer: SceneEntitySource | undefined;
    this.host.map.game.entities.forEachEntity((entity) => {
      const source: SceneEntitySource = {
        modelindex: entity.modelindex,
        origin: entity.origin,
        angles: entity.angles,
        svflags: entity.svflags,
        inUse: entity.inUse,
        frame: entity.frame,
        skin: entity.skin,
        effects: entity.effects,
        ...(entity.modelindex ? this.frameLerp.sample(entity.index, entity.modelindex, entity.frame ?? 0, nowMs) : {}),
      };
      if (entity === player) viewer = source;
      entities.push(source);
      // CL_AddPacketEntities: a blaster bolt, rocket or grenade carries its own light.
      if (entity.inUse && entity.effects) {
        processEntityEffects({ effects: entity.effects, renderfx: entity.renderfx ?? 0, origin: entity.origin }, entityLights, gameSeconds);
      }
    });
    const modelName = (i: number) => this.host.modelName(i);
    const drawn: RenderableEntity[] = modelEntitiesFromEntities(entities, modelName, {
      models: this.models,
      timeSeconds,
      viewer,
    });
    const gunindex = player?.client?.gunindex ?? 0;
    const gunFrame = player?.client?.gun_frame ?? 0;
    const gunBlend = gunindex ? this.frameLerp.sample(-1, gunindex, gunFrame, nowMs) : undefined;
    this.frameLerp.endFrame();
    const weapon = player && gunindex
      ? viewWeaponEntity({
          ...gunBlend,
          origin: { x: this.camera.position[0], y: this.camera.position[1], z: this.camera.position[2] },
          angles: { x: this.camera.angles[0], y: this.camera.angles[1], z: this.camera.angles[2] },
          model: this.host.modelName(gunindex),
          frame: gunFrame,
          models: this.models,
        })
      : undefined;
    if (weapon) drawn.push(weapon);
    this.lastDrawn = drawn;
    this.renderer.renderFrame(
      {
        camera: this.camera,
        world: this.world,
        clearColor: [0, 0, 0, 1],
        timeSeconds,
        deltaTime,
        dlights: [...this.dlights.getActiveLights(), ...entityLights],
        brushModels: brushModelsFromEntities(entities, modelName),
      },
      drawn,
    );
  }

  /**
   * CL_SetLightstyle: the game's CS_LIGHTS configstrings (the table SP_worldspawn sets, and a
   * switchable light's on and off) are the patterns the renderer plays for each style.
   */
  private syncLightStyles(): void {
    for (let i = 0; i < MAX_LIGHTSTYLES; i++) {
      const pattern = this.host.configstring(ConfigStringIndex.Lights + i) ?? null;
      if (pattern === this.lightStyles[i]) continue;
      this.lightStyles[i] = pattern;
      this.renderer.setLightStyle(i, pattern);
    }
  }

  private report(): void {
    const player = this.host.player;
    if (!player || !this.options.onStatus) return;
    const status: PlayerStatus = {
      health: player.health,
      dead: player.health <= 0,
      map: this.host.map.name,
    };
    const key = JSON.stringify(status);
    if (key === this.lastStatus) return;
    this.lastStatus = key;
    this.options.onStatus(status);
  }
}
