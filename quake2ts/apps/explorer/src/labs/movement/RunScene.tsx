// The run in 3D: demo1 drawn by the engine's own WebGL renderer (prepareWorld, uploadWorld,
// renderFrame, as /play does), with this run's path and the game's drawn through it as lines and
// the player's box where each run ends. The camera orbits the run (orbit.ts): drag or the arrow
// keys turn it, Ctrl or Cmd with the wheel and + and - zoom, 0 puts it back. Plain wheel scrolls
// the pane, so the charts below stay reachable. It draws only when something changes (the runs,
// the camera or the size); nothing moves on its own, so there is no animation loop.
import * as React from 'react';
import { Alert, Button, Skeleton } from 'strata-react';
import { Camera, createRenderer, prepareWorld, type Renderer, type WorldRenderState } from '@quake2ts/engine';
import type { BspMap } from '@quake2ts/formats/bsp';
import { useLibrary } from '../../library/context';
import { traceBox } from '@quake2ts/shared/bsp/collision';
import { MASK_SOLID } from '@quake2ts/shared/bsp/contents';
import { clipEye, describeOrbit, dragOrbit, frameRun, keyOrbit, orbitEye, zoomOrbit, type Orbit } from './orbit';
import type { MovementFrame, MovementWorld } from './simulate';

/** The camera's own small box, so it stops a little short of a wall rather than in it. */
const CAMERA_BOX = { mins: { x: -4, y: -4, z: -4 }, maxs: { x: 4, y: 4, z: 4 } };
const PLAYER_MINS = { x: -16, y: -16, z: -24 };
const PLAYER_MAXS = { x: 16, y: 16, z: 32 };
/** This run, in a warm colour that stands out on Quake's browns and greys; the game's, in pale grey. */
const RUN_COLOUR = { r: 1, g: 0.72, b: 0.16, a: 1 };
const GAME_COLOUR = { r: 0.85, g: 0.88, b: 0.92, a: 0.85 };

type Scene = { gl: WebGL2RenderingContext; renderer: Renderer; world: WorldRenderState; camera: Camera };
type SceneState = { status: 'loading' } | { status: 'ready'; scene: Scene } | { status: 'failed'; reason: string };

export function RunScene({ map, world: movement, run, base }: { map: BspMap; world: MovementWorld; run: readonly MovementFrame[]; base: readonly MovementFrame[] }) {
  const { library } = useLibrary();
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const [state, setState] = React.useState<SceneState>({ status: 'loading' });
  const home = React.useMemo(() => frameRun(base), [base]);
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
      setState({ status: 'failed', reason: 'This browser has no WebGL 2, which the 3D view is drawn with. The charts below show the same runs.' });
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
        if (!cancelled) setState({ status: 'failed', reason: `demo1 could not be drawn: ${e instanceof Error ? e.message : String(e)}.` });
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

  // A new home view when the game's run changes (another map, or a world read again).
  React.useEffect(() => setOrbit(home), [home]);

  // Draw whenever the runs, the camera or the size change.
  React.useEffect(() => {
    if (state.status !== 'ready' || !size.width || !size.height) return;
    const { gl, renderer, world, camera } = state.scene;
    const canvas = gl.canvas as HTMLCanvasElement;
    canvas.width = size.width;
    canvas.height = size.height;
    camera.setAspectRatio(size.width / size.height);
    // The camera stays inside the level (see clipEye): the renderer draws only what its cluster sees.
    const eye = clipEye(orbit.target, orbitEye(orbit), (from, to) =>
      traceBox({ model: movement.model, start: from, end: to, mins: CAMERA_BOX.mins, maxs: CAMERA_BOX.maxs, contentMask: MASK_SOLID }).fraction,
    );
    camera.setPosition(eye.x, eye.y, eye.z);
    camera.setRotation(orbit.pitch, orbit.yaw, 0);
    drawPath(renderer, base, GAME_COLOUR);
    drawPath(renderer, run, RUN_COLOUR);
    gl.viewport(0, 0, size.width, size.height);
    renderer.renderFrame({ camera, world, clearColor: [0, 0, 0, 1], timeSeconds: 0 }, []);
  }, [state, size, orbit, run, base, movement]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    const next = keyOrbit(orbit, e.key, home);
    if (!next) return;
    e.preventDefault();
    setOrbit(next);
  };
  const onWheel = (e: React.WheelEvent) => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    setOrbit((o) => zoomOrbit(o, e.deltaY > 0 ? 1.1 : 0.9));
  };

  return (
    <section aria-label="The runs in 3D" className="grid gap-2">
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
            aria-label={`demo1 with this run's path in amber and the game's in grey. ${describeOrbit(orbit)} Drag or use the arrow keys to turn, Control and the wheel or plus and minus to zoom, 0 to go back.`}
            className="block aspect-video w-full cursor-grab touch-none rounded-surface bg-muted active:cursor-grabbing"
            onKeyDown={onKeyDown}
            onWheel={onWheel}
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
          <span>Amber: this run. Grey: the game's values. A box marks where each run ends.</span>
          <Button size="sm" variant="ghost" className="ms-auto" onPress={() => setOrbit(home)}>
            Back to the side view
          </Button>
        </div>
      ) : null}
    </section>
  );
}

/** A run's path as line segments through the player's origin, and its box where it ends. */
function drawPath(renderer: Renderer, frames: readonly MovementFrame[], colour: { r: number; g: number; b: number; a: number }) {
  for (let i = 1; i < frames.length; i++) renderer.collisionVis.addLine(frames[i - 1]!.origin, frames[i]!.origin, colour);
  const end = frames.at(-1)?.origin;
  if (!end) return;
  renderer.collisionVis.addBBox(
    { x: end.x + PLAYER_MINS.x, y: end.y + PLAYER_MINS.y, z: end.z + PLAYER_MINS.z },
    { x: end.x + PLAYER_MAXS.x, y: end.y + PLAYER_MAXS.y, z: end.z + PLAYER_MAXS.z },
    colour,
  );
}
