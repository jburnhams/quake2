// One question: "What does each movement constant do to a player?" The finding is how this run
// differs from the game's: the same scripted run (forward, one jump, let go) on demo1, through
// the game's own runPmove and the map's collision, drawn beside the run the shipped values give.
// The constants are sliders on the left and live in the URL; the run is redrawn on every change,
// since 100 frames of runPmove take a few milliseconds. The stage is demo1 in 3D through the
// engine's renderer (RunScene) with both paths drawn in it, then the figures and the charts,
// which say the same in numbers and stand in when the browser has no WebGL 2.
import * as React from 'react';
import {
  ButtonLink,
  ColorSchemeChoice,
  DataView,
  EmptyState,
  Field,
  LineChart,
  Metric,
  MetricStrip,
  Pane,
  Skeleton,
  Slider,
  Split,
  TextLink,
  Workspace,
  format,
  useLoad,
  useWorkspaceState,
  type ChartSpan,
  type Point,
} from 'strata-react';
import { RotateCcw } from 'lucide-react';
import { parseBsp, type BspMap } from '@quake2ts/formats/bsp';
import { RunScene } from './RunScene';
import { useDemoPak, useLibrary } from '../../library/context';
import { CONSTANTS, useLabTuning } from './constants';
import {
  DEFAULT_LAB_TUNING,
  FRAME_MSEC,
  JUMP_FRAME,
  RELEASE_FRAME,
  simulateRun,
  summarise,
  worldFromMap,
  type MovementFrame,
  type MovementWorld,
} from './simulate';

export const LAB_MAP = 'maps/demo1.bsp';
export const LAB_PATH = '/labs/movement';

export function MovementLab() {
  const workspace = useWorkspaceState('movement-lab');
  const demo = useDemoPak();
  const { library, version } = useLibrary();
  const lab = useLabTuning();
  const world = useLoad<{ map: BspMap; world: MovementWorld } | null>({
    queryKey: ['lab-world', version, LAB_MAP],
    enabled: demo.status !== 'loading',
    staleTime: Infinity,
    retry: false,
    queryFn: async () => {
      if (!library.vfs.hasFile(LAB_MAP)) return null;
      const map = parseBsp(await library.read(LAB_MAP));
      return { map, world: worldFromMap(map) };
    },
    describeError: (e) => `${LAB_MAP} could not be read: ${e instanceof Error ? e.message : String(e)}.`,
  });

  return (
    <div className="h-dvh">
      <Workspace label="Movement lab" state={workspace} narrowBelow={720}>
        <header className="flex min-h-(--control-h) shrink-0 flex-wrap items-center gap-3 border-b border-border px-3 py-1">
          <h1 className="type-label">Movement lab</h1>
          <p className="type-body-sm text-muted-foreground" aria-live="polite">
            {lab.changed.length
              ? `${format.count(lab.changed.length, 'constant')} changed: ${lab.changed.map((c) => c.label.toLowerCase()).join(', ')}`
              : "Every constant at the game's value"}
          </p>
          <div className="ms-auto flex items-center gap-2">
            <TextLink to="/">Explorer</TextLink>
            <ColorSchemeChoice compact />
          </div>
        </header>
        <Split direction="row">
          <Pane
            id="constants"
            name="Constants"
            size={320}
            min={260}
            max={480}
            collapsible
            actions={
              lab.changed.length ? (
                <ButtonLink to={LAB_PATH} size="sm" variant="ghost" icon={RotateCcw}>
                  Reset
                </ButtonLink>
              ) : null
            }
          >
            <div className="grid gap-4 p-3">
              {CONSTANTS.map((c) => (
                <Field
                  key={c.key}
                  label={c.label}
                  hint={`${c.hint} The game uses ${format.decimal.format(DEFAULT_LAB_TUNING[c.key])}${c.unit ? ` ${c.unit}` : ''}.`}
                >
                  <Slider
                    value={lab.tuning[c.key]}
                    onChange={(v) => lab.set(c.key, v)}
                    min={c.min}
                    max={c.max}
                    step={c.step}
                    unit={c.unit}
                  />
                </Field>
              ))}
            </div>
          </Pane>
          <Pane id="run" name="Run on demo1" grow>
            <DataView
              state={world}
              skeleton={<RunSkeleton />}
              isEmpty={(w) => w === null}
              empty={
                <EmptyState title="demo1 is not open">
                  The lab runs on {LAB_MAP}, from the demo PAK. Open a PAK that has it in the <TextLink to="/">explorer</TextLink>.
                </EmptyState>
              }
            >
              {(w) => <RunView map={w!.map} world={w!.world} />}
            </DataView>
          </Pane>
        </Split>
      </Workspace>
    </div>
  );
}

function RunView({ map, world }: { map: BspMap; world: MovementWorld }) {
  const { tuning } = useLabTuning();
  const base = React.useMemo(() => simulateRun(world), [world]);
  const run = React.useMemo(() => simulateRun(world, tuning), [world, ...Object.values(tuning)]);
  const mine = summarise(run);
  const game = summarise(base);

  const units = (n: number, unit: string) => `${format.integer.format(Math.round(n))} ${unit}`;
  const seconds = (n: number) => `${format.decimal.format(Math.round(n * 100) / 100)} s`;
  const against = (n: number, g: number, say: (x: number) => string) =>
    Math.abs(n - g) < 0.5 ? "The same as the game's." : `The game's run: ${say(g)}.`;

  return (
    <div className="grid gap-4 p-4">
      <p className="type-body-sm text-muted-foreground">
        The player runs forward from demo1's start, jumps after {seconds((JUMP_FRAME * FRAME_MSEC) / 1000)}, lets go after{' '}
        {seconds((RELEASE_FRAME * FRAME_MSEC) / 1000)} and slides to a stop, through the game's own movement code and the map's walls and floors.
      </p>
      <RunScene map={map} world={world} run={run} base={base} />
      <MetricStrip label="This run">
        <Metric label="Top speed" value={units(mine.topSpeed, 'u/s')} note={against(mine.topSpeed, game.topSpeed, (g) => units(g, 'u/s'))} />
        <Metric label="Highest point" value={units(mine.peakHeight, 'u')} note={against(mine.peakHeight, game.peakHeight, (g) => units(g, 'u'))} />
        <Metric label="Time in the air" value={seconds(mine.airtime)} note={against(mine.airtime * 100, game.airtime * 100, () => seconds(game.airtime))} />
        <Metric label="Distance" value={units(mine.distance, 'u')} note={against(mine.distance, game.distance, (g) => units(g, 'u'))} />
      </MetricStrip>
      <LineChart
        label="Height over distance: the path of this run beside the game's"
        series={path(run)}
        seriesLabel="This run"
        planned={path(base)}
        plannedLabel="The game's values"
        formatX={(x) => units(x, 'u')}
        xLabel="Distance"
        formatY={(y) => units(y, 'u')}
        xTicks={({ max }) => ticks(max, 100)}
        end="none"
        readout
        height={220}
      />
      <LineChart
        label="Speed over time: how fast the player runs, then slows"
        series={run.map((f) => ({ x: f.t, y: f.speed }))}
        seriesLabel="This run"
        planned={base.map((f) => ({ x: f.t, y: f.speed }))}
        plannedLabel="The game's values"
        spans={airborne(run)}
        formatX={seconds}
        xLabel="Time"
        formatY={(y) => units(y, 'u/s')}
        xTicks={[0, 0.5, 1, 1.5, 2, 2.5]}
        end="none"
        readout
        height={200}
      />
    </div>
  );
}

const path = (frames: readonly MovementFrame[]): Point[] => frames.map((f) => ({ x: f.distance, y: f.height }));

function ticks(max: number, step: number): number[] {
  const out: number[] = [];
  for (let x = 0; x <= max; x += step) out.push(x);
  return out;
}

/** The stretches of the run the player is off the ground. */
function airborne(frames: readonly MovementFrame[]): ChartSpan[] {
  const spans: ChartSpan[] = [];
  let from: number | null = null;
  frames.forEach((f, i) => {
    const t0 = i * (FRAME_MSEC / 1000);
    if (!f.onGround && from === null) from = t0;
    if ((f.onGround || i === frames.length - 1) && from !== null) {
      spans.push({ from, to: f.t, label: 'In the air', tone: 'info' });
      from = null;
    }
  });
  return spans;
}

function RunSkeleton() {
  return (
    <div className="grid gap-4 p-4" aria-hidden>
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-56 w-full" />
      <Skeleton className="h-48 w-full" />
    </div>
  );
}
