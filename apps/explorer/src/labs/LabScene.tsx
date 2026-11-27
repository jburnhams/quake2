// A lab's 3D stage: a map drawn by the engine's own WebGL renderer (prepareWorld, uploadWorld,
// renderFrame, as /play does), with whatever the lab draws in it as lines and boxes through the
// renderer's collisionVis. The camera orbits (orbit.ts): drag or the arrow keys turn it, Ctrl or
// Cmd with the wheel and + and - zoom, 0 puts it back; plain wheel scrolls the pane, so what is
// below stays reachable. It draws only when something changes (the drawing, the camera or the
// size, or the time a lab gives it); nothing moves on its own, so there is no animation loop: a
// lab that animates passes a new `timeSeconds`. Without WebGL 2 it says so, and the lab's figures
// carry the same facts.
// A lab that plays a recording (the demo player) also gives it `entities` (brush models and MD2s,
// as /play draws them, with the first-person weapon) and `follow`: the camera's target (and, for a
// camera that turns with the player, their angles) moves with the recording while the person's own
// drag and zoom are kept on top of it, so they can look round while it plays.
import * as React from 'react';
import { Alert, Button, Skeleton } from 'strata-react';
import {
  Camera,
  DebugMode,
  brushModelsFromEntities,
  createRenderer,
  modelEntitiesFromEntities,
  prepareModels,
  ParticleSystem,
  prepareWorld,
  viewWeaponEntity,
  type DLight,
  type Md2Model,
  type Renderer,
  type SceneEntitySource,
  type WorldRenderState,
} from '@quake2ts/engine';
import { RandomGenerator } from '@quake2ts/shared';
import type { BspMap } from '@quake2ts/formats/bsp';
import { traceBox, type CollisionModel } from '@quake2ts/shared/bsp/collision';
import { MASK_SOLID } from '@quake2ts/shared/bsp/contents';
import { useLibrary } from '../library/context';
import { clipEye, describeOrbit, dragOrbit, keyOrbit, orbitEye, zoomOrbit, type Orbit, type Vec } from './orbit';

/** A colour for the lab's lines, 0 to 1 per channel. */
export type LineColour = { r: number; g: number; b: number; a: number };

/** What a lab draws with: lines and boxes in world units. */
export interface Lines {
  line(from: Vec, to: Vec, colour: LineColour): void;
  box(mins: Vec, maxs: Vec, colour: LineColour): void;
}

/** A warm colour that stands out on Quake's browns and greys: the thing the lab changes. */
export const AMBER: LineColour = { r: 1, g: 0.72, b: 0.16, a: 1 };
/** Pale grey: what the game does, or what the lab compares against. */
export const GREY: LineColour = { r: 0.85, g: 0.88, b: 0.92, a: 0.85 };
/** Pale blue: a direction, such as a plane's normal. */
export const BLUE: LineColour = { r: 0.45, g: 0.75, b: 1, a: 1 };

/** What a recording puts in the world: its entities, and the weapon in the player's hand. */
export interface LabEntities {
  /** The MD2s the entities use, loaded once for each list. Keep it stable (useMemo). */
  readonly models: readonly string[];
  readonly sources: readonly SceneEntitySource[];
  /** What a modelindex names ("*3", "models/monsters/soldier/tris.md2"). */
  readonly modelName: (index: number) => string | undefined;
  /** The first-person weapon, drawn at the camera. */
  readonly weapon?: {
    readonly model: string;
    readonly frame: number;
    readonly oldFrame?: number;
    readonly frameLerp?: number;
    /** Added to the camera's position and angles, as CL_AddViewWeapon adds gun_offset and gun_angles to the view's. */
    readonly offset?: Vec;
    readonly angleOffset?: Vec;
  };
}

/** A target that moves (a recorded player), and angles the person's own turn is added to. */
export interface LabFollow {
  readonly target: Vec;
  readonly yaw?: number;
  readonly pitch?: number;
}

const NO_MODELS: ReadonlyMap<string, Md2Model> = new Map();

const NO_PORTALS: ReadonlyArray<readonly [number, boolean]> = [];
const NO_STYLES: ReadonlyArray<readonly [number, string | null]> = [];

/** A particle as the client hands it to the renderer: a point, its colour and alpha (0 to 1). */
export interface SceneParticle {
  readonly origin: Vec;
  readonly colour: readonly [number, number, number, number];
}

/** A dynamic light as V_AddLight makes one: a point, a colour (0 to 1) and a radius. */
export interface SceneLight {
  readonly origin: Vec;
  readonly colour: Vec;
  readonly intensity: number;
}

/** How the world's surfaces are lit: textures times lightmaps (as the game draws), the lightmaps alone, or the textures alone. */
export type SceneLook = 'lit' | 'lightmap' | 'fullbright';

/** The camera's own small box, so it stops a little short of a wall rather than in it. */
const CAMERA_BOX = { mins: { x: -4, y: -4, z: -4 }, maxs: { x: 4, y: 4, z: 4 } };

type Scene = { gl: WebGL2RenderingContext; renderer: Renderer; world: WorldRenderState; camera: Camera; particles: ParticleSystem };
type SceneState = { status: 'loading' } | { status: 'ready'; scene: Scene } | { status: 'failed'; reason: string };

export interface LabSceneProps {
  /** Names the stage: "The runs in 3D". */
  label: string;
  /** What is drawn, in words, for the canvas's accessible name. */
  shows: string;
  /** The key under the view: "Amber: this run. Grey: the game's values." */
  legend: React.ReactNode;
  map: BspMap;
  /** The map's collision, which keeps the camera inside the level. */
  model: CollisionModel;
  /** Where the camera starts and what 0 returns to. A new value moves the camera there. */
  home: Orbit;
  /** Draws the lab's lines. A new function draws again, so keep it stable (useCallback) between changes. */
  draw: (lines: Lines) => void;
  /**
   * Stand the camera at the target and look out from it, instead of orbiting round it: the
   * renderer then culls from that very point, as the game's does from the player's eye. Dragging
   * and the arrow keys turn the head; zoom does nothing.
   */
  standAt?: boolean;
  /** Area portals to open or close before drawing (renderer.setAreaPortalState), as [number, open]. */
  portals?: ReadonlyArray<readonly [number, boolean]>;
  /** Light style patterns to play (renderer.setLightStyle), as [style, pattern]; null puts a style back to full. */
  lightStyles?: ReadonlyArray<readonly [number, string | null]>;
  /** The time the light styles are played at. */
  timeSeconds?: number;
  look?: SceneLook;
  /** Entities to draw in the world (a recording's). */
  entities?: LabEntities;
  /**
   * Keeps the camera on a moving target: the orbit's target is replaced by it, and its yaw and
   * pitch are added to the orbit's, so `home` holds the person's own turn (0 is none).
   */
  follow?: LabFollow;
  /** Particles to draw this frame (the client's, which the lab moves itself), held still. */
  particles?: readonly SceneParticle[];
  /** Dynamic lights to light the world with this frame. */
  lights?: readonly SceneLight[];
  /** Told of every turn of the camera (a drag, a key, a new home), so a lab can show the way it faces elsewhere. */
  onTurn?: (orbit: Orbit) => void;
}

export function LabScene({ label, shows, legend, map, model, home, draw, standAt = false, portals = NO_PORTALS, lightStyles = NO_STYLES, timeSeconds = 0, look = 'lit', entities, follow, particles, lights, onTurn }: LabSceneProps) {
  const { library } = useLibrary();
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const [state, setState] = React.useState<SceneState>({ status: 'loading' });
  const [orbit, setOrbit] = React.useState<Orbit>(home);
  const [size, setSize] = React.useState({ width: 0, height: 0 });
  const [models, setModels] = React.useState<ReadonlyMap<string, Md2Model>>(NO_MODELS);
  const drag = React.useRef<{ x: number; y: number } | null>(null);

  // Set up the renderer and the world once per map.
  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancelled = false;
    const gl = canvas.getContext('webgl2', { antialias: true });
    if (!gl) {
      setState({ status: 'failed', reason: 'This browser has no WebGL 2, which the 3D view is drawn with. The figures below say the same.' });
      return;
    }
    (async () => {
      try {
        const files = { readFile: async (path: string) => new Uint8Array(await library.read(path)) };
        const prepared = await prepareWorld(map, files);
        if (cancelled) return;
        const renderer = createRenderer(gl);
        const world = renderer.uploadWorld(prepared);
        const camera = new Camera(canvas.width || 1, canvas.height || 1);
        camera.fov = 75;
        // The lab's own particles: it places every one each frame, so nothing here moves them.
        const own = new ParticleSystem(4096, new RandomGenerator({ seed: 1 }));
        setState({ status: 'ready', scene: { gl, renderer, world, camera, particles: own } });
      } catch (e) {
        if (!cancelled) setState({ status: 'failed', reason: `The map could not be drawn: ${e instanceof Error ? e.message : String(e)}.` });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [map, library]);

  // Load the entities' models once the world is up; one that fails to load is left undrawn.
  const wanted = entities?.models;
  React.useEffect(() => {
    if (state.status !== 'ready' || !wanted?.length) return;
    let cancelled = false;
    const files = { readFile: async (path: string) => new Uint8Array(await library.read(path)) };
    prepareModels(files, wanted).then(
      (prepared) => {
        if (cancelled) return;
        state.scene.renderer.uploadModels(state.scene.world, prepared);
        setModels(prepared.models);
      },
      () => undefined,
    );
    return () => {
      cancelled = true;
    };
  }, [state, wanted, library]);

  // Size the drawing buffer to the canvas's box, in device pixels.
  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => {
      const box = entry!.contentRect;
      const ratio = window.devicePixelRatio || 1;
      setSize({ width: Math.round(box.width * ratio), height: Math.round(box.height * ratio) });
    });
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  React.useEffect(() => setOrbit(home), [home]);

  // The latest onTurn, so a new function each render does not count as a turn.
  const turned = React.useRef(onTurn);
  turned.current = onTurn;
  React.useEffect(() => turned.current?.(orbit), [orbit]);

  // The orbit the camera is at: the person's own, moved onto what it follows.
  const view: Orbit = follow
    ? {
        ...orbit,
        target: follow.target,
        yaw: orbit.yaw + (follow.yaw ?? 0),
        pitch: Math.min(89, Math.max(-89, orbit.pitch + (follow.pitch ?? 0))),
      }
    : orbit;

  // Ctrl or Cmd with the wheel (and a trackpad pinch, which arrives as one) zooms the camera. A
  // native listener, since React's wheel listener is passive and cannot stop the page zooming too.
  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onWheel = (e: WheelEvent) => {
      if (standAt || (!e.ctrlKey && !e.metaKey)) return;
      e.preventDefault();
      setOrbit((o) => zoomOrbit(o, e.deltaY > 0 ? 1.1 : 0.9));
    };
    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', onWheel);
  }, [state.status, standAt]);

  // Draw whenever the drawing, the camera or the size change.
  React.useEffect(() => {
    if (state.status !== 'ready' || !size.width || !size.height) return;
    const { gl, renderer, world, camera } = state.scene;
    const canvas = gl.canvas as HTMLCanvasElement;
    canvas.width = size.width;
    canvas.height = size.height;
    camera.setAspectRatio(size.width / size.height);
    // The camera stays inside the level (see clipEye): the renderer draws only what its cluster sees.
    const eye = standAt
      ? view.target
      : clipEye(view.target, orbitEye(view), (from, to) =>
          traceBox({ model, start: from, end: to, mins: CAMERA_BOX.mins, maxs: CAMERA_BOX.maxs, contentMask: MASK_SOLID }).fraction,
        );
    for (const [number, open] of portals) renderer.setAreaPortalState(number, open);
    for (const [style, pattern] of lightStyles) renderer.setLightStyle(style, pattern);
    renderer.setDebugMode(look === 'lightmap' ? DebugMode.Lightmaps : DebugMode.None);
    renderer.setFullbright(look === 'fullbright');
    camera.setPosition(eye.x, eye.y, eye.z);
    camera.setRotation(view.pitch, view.yaw, 0);
    draw({
      line: (from, to, colour) => renderer.collisionVis.addLine(from, to, colour),
      box: (mins, maxs, colour) => renderer.collisionVis.addBBox(mins, maxs, colour),
    });
    let own: ParticleSystem | undefined;
    if (particles) {
      own = state.scene.particles;
      own.killAll();
      for (const p of particles) own.spawn({ position: p.origin, color: p.colour, size: 2, lifetime: 1, gravity: 0, fade: false });
    }
    const dlights: DLight[] | undefined = lights?.map((l) => ({ origin: l.origin, color: l.colour, intensity: l.intensity, die: Infinity }));
    gl.viewport(0, 0, size.width, size.height);
    const drawn = entities ? modelEntitiesFromEntities(entities.sources, entities.modelName, { models, timeSeconds }) : [];
    const weapon = entities?.weapon
      ? viewWeaponEntity({
          ...entities.weapon,
          origin: {
            x: camera.position[0] + (entities.weapon.offset?.x ?? 0),
            y: camera.position[1] + (entities.weapon.offset?.y ?? 0),
            z: camera.position[2] + (entities.weapon.offset?.z ?? 0),
          },
          angles: {
            x: camera.angles[0] + (entities.weapon.angleOffset?.x ?? 0),
            y: camera.angles[1] + (entities.weapon.angleOffset?.y ?? 0),
            z: camera.angles[2] + (entities.weapon.angleOffset?.z ?? 0),
          },
          models,
        })
      : undefined;
    if (weapon) drawn.push(weapon);
    const brushModels = entities ? brushModelsFromEntities(entities.sources, entities.modelName) : undefined;
    renderer.renderFrame({ camera, world, clearColor: [0, 0, 0, 1], timeSeconds, brushModels, particles: own, dlights }, drawn);
  }, [state, size, view.target, view.yaw, view.pitch, view.distance, draw, model, standAt, portals, lightStyles, timeSeconds, look, entities, models, particles, lights]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (standAt && ['+', '=', '-', '_'].includes(e.key)) return;
    const next = keyOrbit(orbit, e.key, home);
    if (!next) return;
    e.preventDefault();
    setOrbit(next);
  };

  return (
    <section aria-label={label} className="grid gap-2">
      {state.status === 'failed' ? (
        <Alert tone="info" title="No 3D view">
          {state.reason}
        </Alert>
      ) : (
        <div className="relative">
          {state.status === 'loading' ? <Skeleton className="absolute inset-0 h-full w-full" /> : null}
          <canvas
            ref={canvasRef}
            tabIndex={0}
            role="img"
            aria-label={
              standAt
                ? `${shows} ${describeOrbit(view, true)} Drag or use the arrow keys to look around, 0 to go back.`
                : `${shows} ${describeOrbit(view)} Drag or use the arrow keys to turn, Control and the wheel or plus and minus to zoom, 0 to go back.`
            }
            className="block aspect-video w-full cursor-grab touch-none rounded-surface bg-muted active:cursor-grabbing"
            onKeyDown={onKeyDown}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              drag.current = { x: e.clientX, y: e.clientY };
            }}
            onPointerMove={(e) => {
              if (!drag.current) return;
              const dx = e.clientX - drag.current.x;
              const dy = e.clientY - drag.current.y;
              drag.current = { x: e.clientX, y: e.clientY };
              setOrbit((o) => dragOrbit(o, dx, dy));
            }}
            onPointerUp={() => (drag.current = null)}
            onPointerCancel={() => (drag.current = null)}
          />
        </div>
      )}
      {state.status === 'ready' ? (
        <div className="flex flex-wrap items-center gap-3 type-body-sm text-muted-foreground">
          <span>{legend}</span>
          <Button size="sm" variant="ghost" className="ms-auto" onPress={() => setOrbit(home)}>
            Back to the first view
          </Button>
        </div>
      ) : null}
    </section>
  );
}
