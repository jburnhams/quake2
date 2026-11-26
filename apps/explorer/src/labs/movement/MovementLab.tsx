// One question: "What does each movement constant do to a player?" The finding is how this run
// differs from the game's: the same scripted run (forward, one jump, let go) on demo1, through
// the game's own runPmove and the map's collision, drawn beside the run the shipped values give.
// The constants are sliders on the left and live in the URL; the run is redrawn on every change,
// since 100 frames of runPmove take a few milliseconds. The stage is demo1 in 3D through the
// engine's renderer (RunScene) with both paths drawn in it, then the figures and the charts,
// which say the same in numbers and stand in when the browser has no WebGL 2. A second view (Air
// strafing, AirView) takes one frame of the air move apart to show why strafe-jumping is faster
// than the top speed; the same constants drive both, and the view is held in the URL.
// The run plays like a video (Jonathan, 2026-11-26), through the labs' one player (LabPlayer):
// it starts at the end, so the still picture is the whole run, and play shows the player making
// the move. The charts mark the playhead and a pick on the speed chart seeks to it. The camera
// (from the side, or through the player's eyes) is in the URL; the time is not, as a link is to
// a run, not a moment.
import * as React from 'react';
import {
  ChoiceGroup,
  LineChart,
  Metric,
  MetricStrip,
  Tabs,
  format,
  useSearchParam,
  type ChartSpan,
  type Point,
} from 'strata-react';
import type { BspMap } from '@quake2ts/formats/bsp';
import { LabScreen } from '../LabScreen';
import { AirView } from './AirView';
import { RunScene, type RunCamera } from './RunScene';
import { LabPlayer, useLabClock } from '../LabPlayer';
import { FRAME_SECONDS, RUN_SECONDS, frameAt } from './at';
import { CONSTANTS, useLabTuning } from './constants';
import {
  DEFAULT_LAB_TUNING,
  FRAME_MSEC,
  JUMP_FRAME,
  RELEASE_FRAME,
  simulateRun,
  summarise,
  type MovementFrame,
  type MovementWorld,
} from './simulate';

export const LAB_PATH = '/labs/movement';

const CAMERAS = [
  { value: 'side', label: 'From the side', detail: "Both runs from their right, so a jump shows as an arc." },
  { value: 'eyes', label: "Through the player's eyes", detail: 'Ride this run at view height, with the game\'s player beside you.' },
];
const parseCamera = (v: string): RunCamera | undefined => (v === 'side' || v === 'eyes' ? v : undefined);

const VIEWS = [
  { value: 'run', label: 'Run on demo1' },
  { value: 'air', label: 'Air strafing' },
];

export function MovementLab() {
  const lab = useLabTuning();
  return (
    <LabScreen
      title="Movement lab"
      path={LAB_PATH}
      stageName="demo1"
      params={CONSTANTS}
      state={lab}
      defaults={DEFAULT_LAB_TUNING}
      defaultWords="The game uses"
      unchanged="Every constant at the game's value"
      noun="constant"
    >
      {({ map, world }) => (
        <Tabs param="view" label="Views" items={VIEWS} className="p-4">
          {(view) => (view === 'air' ? <AirView tuning={lab.tuning} path={LAB_PATH} /> : <RunView map={map} world={world} />)}
        </Tabs>
      )}
    </LabScreen>
  );
}

function RunView({ map, world }: { map: BspMap; world: MovementWorld }) {
  const { tuning } = useLabTuning();
  const base = React.useMemo(() => simulateRun(world), [world]);
  const run = React.useMemo(() => simulateRun(world, tuning), [world, ...Object.values(tuning)]);
  const [camera, setCamera] = useSearchParam<RunCamera>('camera', { default: 'side', parse: parseCamera });
  const clock = useLabClock({ duration: RUN_SECONDS, frame: FRAME_SECONDS, start: RUN_SECONDS });
  const at = React.useMemo(
    () => ({ run: frameAt(run, world.start.origin, clock.time), base: frameAt(base, world.start.origin, clock.time) }),
    [run, base, world, clock.time],
  );
  const mine = summarise(run);
  const game = summarise(base);

  const units = (n: number, unit: string) => `${format.integer.format(Math.round(n))} ${unit}`;
  const seconds = (n: number) => `${format.decimal.format(Math.round(n * 100) / 100)} s`;
  const against = (n: number, g: number, say: (x: number) => string) =>
    Math.abs(n - g) < 0.5 ? "The same as the game's." : `The game's run: ${say(g)}.`;

  return (
    <div className="grid gap-4">
      <p className="type-body-sm text-muted-foreground">
        The player runs forward from demo1's start, jumps after {seconds((JUMP_FRAME * FRAME_MSEC) / 1000)}, lets go after{' '}
        {seconds((RELEASE_FRAME * FRAME_MSEC) / 1000)} and slides to a stop, through the game's own movement code and the map's walls and floors.
      </p>
      <RunScene map={map} world={world} run={run} base={base} at={{ run: at.run.origin, base: at.base.origin }} camera={camera} />
      <LabPlayer
        clock={clock}
        label="The run"
        frame={FRAME_SECONDS}
        marks={[
          { time: JUMP_FRAME * FRAME_SECONDS, label: 'Jump' },
          { time: RELEASE_FRAME * FRAME_SECONDS, label: 'Let go' },
        ]}
        spans={airborne(run).map((s) => ({ start: s.from, end: s.to, label: 'In the air' }))}
      />
      <ChoiceGroup legend="Camera" name="camera" value={camera} onChange={(v) => setCamera(v as RunCamera)} choices={CAMERAS} />
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
        current={at.run.distance}
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
        current={clock.time}
        onPick={clock.seek}
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
