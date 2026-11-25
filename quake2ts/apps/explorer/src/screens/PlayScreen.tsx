// One question: "Can I walk demo1?" The game fills the screen; a strip above it says how to start
// (a click captures the mouse, as a browser requires for mouse look), the controls, and the
// player's health, which is the one figure a person checks while playing. What is not drawn yet
// is said beside the game, so a missing weapon or effect is not taken for a bug.
//
// Movement keys are held, not pressed, so they are read from keydown/keyup on the canvas rather
// than through useHotkeys (which binds single presses to actions); they only reach the game while
// the pointer is captured, so typing elsewhere on the page never moves the player.
import * as React from 'react';
import { Alert, Button, ButtonLink, DataView, EmptyState, LoadError, Skeleton, Status, format } from 'strata-react';
import { RotateCcw } from 'lucide-react';
import { useDemoPak, useLibrary } from '../library/context';
import { DemoProgress } from '../library/DemoProgress';
import { GameSession, type PlayerStatus } from '../play/session';
import { readResolution, type FrameTimings, type Resolution } from '../play/stats';

const CONTROLS: [string, string][] = [
  ['W A S D', 'Move'],
  ['Mouse', 'Look'],
  ['Click', 'Fire'],
  ['Space', 'Jump'],
  ['C', 'Crouch'],
  ['Esc', 'Let go of the mouse'],
];

export function PlayScreen() {
  const demo = useDemoPak();
  const { library } = useLibrary();
  return (
    <div className="flex h-dvh flex-col bg-background">
      <header className="flex min-h-(--control-h) shrink-0 flex-wrap items-center gap-3 border-b border-border px-3 py-1">
        <h1 className="type-label">Play demo1</h1>
        <p className="type-body-sm text-muted-foreground">
          The world, doors, lifts, monsters and items are drawn. Not yet: the weapon in your hands, effects and sound.
        </p>
        <div className="ms-auto flex items-center gap-2">
          <ButtonLink to="/explore" size="sm" variant="ghost">
            Explorer
          </ButtonLink>
          <ButtonLink to="/" size="sm" variant="ghost">
            About quake2ts
          </ButtonLink>
        </div>
      </header>
      <div className="relative min-h-0 flex-1">
      <DataView
        state={demo}
        skeleton={
          <div className="grid max-w-md gap-3 p-4">
            <DemoProgress />
            <Skeleton className="h-64 w-full" />
          </div>
        }
        isEmpty={() => !library.vfs.hasFile('maps/demo1.bsp')}
        empty={<EmptyState title="demo1 is not in the open PAK files">Open the demo's pak0.pak in the explorer.</EmptyState>}
        error={(failure) => (
          <div className="grid max-w-md gap-2 p-4">
            <LoadError {...failure} />
          </div>
        )}
      >
        {() => <Game />}
      </DataView>
      </div>
    </div>
  );
}

type GameState = { phase: 'loading' } | { phase: 'failed'; message: string } | { phase: 'running'; session: GameSession };

function Game() {
  const { library } = useLibrary();
  const canvas = React.useRef<HTMLCanvasElement>(null);
  const [state, setState] = React.useState<GameState>({ phase: 'loading' });
  const [status, setStatus] = React.useState<PlayerStatus | null>(null);
  const [captured, setCaptured] = React.useState(false);

  React.useEffect(() => {
    const el = canvas.current!;
    let stop = () => {};
    let cancelled = false;
    fit(el);
    GameSession.start({ canvas: el, files: library.vfs, onStatus: setStatus })
      .then((session) => {
        if (cancelled) return;
        stop = session.run();
        setState({ phase: 'running', session });
      })
      .catch((e: unknown) => !cancelled && setState({ phase: 'failed', message: e instanceof Error ? e.message : String(e) }));
    return () => {
      cancelled = true;
      stop();
    };
  }, [library]);

  const session = state.phase === 'running' ? state.session : null;

  React.useEffect(() => {
    const el = canvas.current;
    if (!session || !el) return;
    const observer = new ResizeObserver(() => {
      const { width, height } = fit(el);
      session.resize(width, height);
    });
    observer.observe(el);
    const onLock = () => {
      const locked = document.pointerLockElement === el;
      setCaptured(locked);
      if (!locked) session.releaseAll();
    };
    const onMove = (e: MouseEvent) => document.pointerLockElement === el && session.look(e.movementX, e.movementY);
    const onKey = (e: KeyboardEvent) => {
      if (document.pointerLockElement !== el) return;
      e.preventDefault();
      session.key(e.code, e.type === 'keydown');
    };
    const onButton = (e: MouseEvent) => document.pointerLockElement === el && e.button === 0 && session.fire(e.type === 'mousedown');
    document.addEventListener('pointerlockchange', onLock);
    document.addEventListener('mousemove', onMove);
    document.addEventListener('keydown', onKey);
    document.addEventListener('keyup', onKey);
    document.addEventListener('mousedown', onButton);
    document.addEventListener('mouseup', onButton);
    const onBlur = () => session.releaseAll();
    window.addEventListener('blur', onBlur);
    return () => {
      observer.disconnect();
      document.removeEventListener('pointerlockchange', onLock);
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('keyup', onKey);
      document.removeEventListener('mousedown', onButton);
      document.removeEventListener('mouseup', onButton);
      window.removeEventListener('blur', onBlur);
    };
  }, [session]);

  const capture = () => {
    if (session && document.pointerLockElement !== canvas.current) void canvas.current?.requestPointerLock();
  };

  return (
    <div className="absolute inset-0">
      <canvas
        ref={canvas}
        className="block h-full w-full bg-black"
        aria-label="demo1, drawn from the player's view"
        role="img"
        onClick={capture}
      />
      <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-wrap items-start gap-2 p-3">
        {status ? (
          <Status tone={status.dead ? 'danger' : status.health < 30 ? 'warning' : 'neutral'}>
            {status.dead ? 'Dead' : `Health ${status.health}`}
          </Status>
        ) : null}
        {session ? <StatsReadout session={session} canvas={canvas} /> : null}
      </div>
      {state.phase === 'failed' ? (
        <div className="absolute inset-0 grid place-items-center p-4">
          <Alert tone="danger" title="The game could not start" announce>
            {state.message}
          </Alert>
        </div>
      ) : state.phase === 'loading' ? (
        <div className="absolute inset-0 grid place-items-center p-4">
          <p className="type-body text-muted-foreground" role="status">
            Loading demo1…
          </p>
        </div>
      ) : !captured ? (
        <div className="absolute inset-0 grid place-items-center p-4">
          <div className="grid max-w-sm gap-3 rounded-surface border border-border bg-popover p-4 text-popover-foreground shadow-overlay">
            {status?.dead ? (
              <Button variant="default" onPress={() => session?.restart()}>
                <RotateCcw aria-hidden className="size-4" />
                Start demo1 again
              </Button>
            ) : (
              <Button variant="default" onPress={capture}>
                Click to play
              </Button>
            )}
            <dl className="type-body-sm grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
              {CONTROLS.map(([keys, what]) => (
                <React.Fragment key={keys}>
                  <dt>
                    <kbd className="font-mono">{keys}</kbd>
                  </dt>
                  <dd className="text-muted-foreground">{what}</dd>
                </React.Fragment>
              ))}
            </dl>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/**
 * FPS and resolution, read twice a second (a figure that changes every frame cannot be read). The
 * drawing buffer follows the screen's pixel ratio up to MAX_PIXEL_RATIO, so on a high-density
 * screen the game is drawn at more pixels than its CSS size, and above the cap at fewer than the
 * screen has; the readout says which.
 */
function StatsReadout({ session, canvas }: { session: GameSession; canvas: React.RefObject<HTMLCanvasElement | null> }) {
  const [reading, setReading] = React.useState<{ timings: FrameTimings | null; resolution: Resolution } | null>(null);
  React.useEffect(() => {
    const read = () => canvas.current && setReading({ timings: session.stats(), resolution: readResolution(canvas.current) });
    read();
    const id = window.setInterval(read, 500);
    return () => window.clearInterval(id);
  }, [session, canvas]);
  if (!reading) return null;
  const { timings, resolution } = reading;
  const { drawn, shown, devicePixelRatio } = resolution;
  const scale = shown.width ? drawn.width / shown.width : 1;
  const n = (v: number, digits = 0) =>
    new Intl.NumberFormat(undefined, { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(v);
  const size = (r: { width: number; height: number }) => `${r.width}×${r.height}`;
  const capped = devicePixelRatio > MAX_PIXEL_RATIO;
  return (
    <dl className="type-caption ms-auto grid grid-cols-[auto_auto] gap-x-3 rounded-control bg-popover/80 px-2 py-1 font-mono tabular-nums text-popover-foreground">
      <dt>FPS</dt>
      <dd className="text-end">{timings ? n(timings.fps) : format.missing}</dd>
      <dt>Worst frame</dt>
      <dd className="text-end">{timings ? `${n(timings.worstFrameMs, 1)} ms` : format.missing}</dd>
      <dt>CPU per frame</dt>
      <dd className="text-end">{timings ? `${n(timings.cpuMs, 1)} ms` : format.missing}</dd>
      <dt>Drawn at</dt>
      <dd className="text-end">{size(drawn)}</dd>
      <dt>Shown at</dt>
      <dd className="text-end">{size(shown)}</dd>
      <dt>Scale</dt>
      <dd className="text-end">
        ×{n(scale, 2)}
        {capped ? ` (screen ×${n(devicePixelRatio, 2)}, capped)` : ''}
      </dd>
    </dl>
  );
}

/** The most device pixels per CSS pixel the game draws at; above it the browser scales the picture up. */
const MAX_PIXEL_RATIO = 2;

/** Sizes the canvas's drawing buffer to its box at the screen's pixel ratio, up to MAX_PIXEL_RATIO. */
function fit(el: HTMLCanvasElement): { width: number; height: number } {
  const ratio = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO);
  const width = Math.max(1, Math.round(el.clientWidth * ratio));
  const height = Math.max(1, Math.round(el.clientHeight * ratio));
  if (el.width !== width) el.width = width;
  if (el.height !== height) el.height = height;
  return { width, height };
}
