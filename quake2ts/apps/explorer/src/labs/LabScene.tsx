// A lab's 3D stage: a map drawn by the engine's own WebGL renderer (prepareWorld, uploadWorld,
// renderFrame, as /play does), with whatever the lab draws in it as lines and boxes through the
// renderer's collisionVis. The camera orbits (orbit.ts): drag or the arrow keys turn it, Ctrl or
// Cmd with the wheel and + and - zoom, 0 puts it back; plain wheel scrolls the pane, so what is
// below stays reachable. It draws only when something changes (the drawing, the camera or the
// size); nothing moves on its own, so there is no animation loop. Without WebGL 2 it says so, and
// the lab's figures carry the same facts.
import * as React from 'react';
import { Alert, Button, Skeleton } from 'strata-react';
import { Camera, createRenderer, prepareWorld, type Renderer, type WorldRenderState } from '@quake2ts/engine';
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

const NO_PORTALS: ReadonlyArray<readonly [number, boolean]> = [];

/** The camera's own small box, so it stops a little short of a wall rather than in it. */
const CAMERA_BOX = { mins: { x: -4, y: -4, z: -4 }, maxs: { x: 4, y: 4, z: 4 } };

type Scene = { gl: WebGL2RenderingContext; renderer: Renderer; world: WorldRenderState; camera: Camera };
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
  /** Told of every turn of the camera (a drag, a key, a new home), so a lab can show the way it faces elsewhere. */
  onTurn?: (orbit: Orbit) => void;
}

export function LabScene({ label, shows, legend, map, model, home, draw, standAt = false, portals = NO_PORTALS, onTurn }: LabSceneProps) {
  const { library } = useLibrary();
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const [state, setState] = React.useState<SceneState>({ status: 'loading' });
  const [orbit, setOrbit] = React.useState<Orbit>(home);
  const [size, setSize] = React.useState({ width: 0, height: 0 });
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
        setState({ status: 'ready', scene: { gl, renderer, world, camera } });
      } catch (e) {
        if (!cancelled) setState({ status: 'failed', reason: `The map could not be drawn: ${e instanceof Error ? e.message : String(e)}.` });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [map, library]);

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
      ? orbit.target
      : clipEye(orbit.target, orbitEye(orbit), (from, to) =>
          traceBox({ model, start: from, end: to, mins: CAMERA_BOX.mins, maxs: CAMERA_BOX.maxs, contentMask: MASK_SOLID }).fraction,
        );
    for (const [number, open] of portals) renderer.setAreaPortalState(number, open);
    camera.setPosition(eye.x, eye.y, eye.z);
    camera.setRotation(orbit.pitch, orbit.yaw, 0);
    draw({
      line: (from, to, colour) => renderer.collisionVis.addLine(from, to, colour),
      box: (mins, maxs, colour) => renderer.collisionVis.addBBox(mins, maxs, colour),
    });
    gl.viewport(0, 0, size.width, size.height);
    renderer.renderFrame({ camera, world, clearColor: [0, 0, 0, 1], timeSeconds: 0 }, []);
  }, [state, size, orbit, draw, model, standAt, portals]);

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
                ? `${shows} ${describeOrbit(orbit, true)} Drag or use the arrow keys to look around, 0 to go back.`
                : `${shows} ${describeOrbit(orbit)} Drag or use the arrow keys to turn, Control and the wheel or plus and minus to zoom, 0 to go back.`
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
