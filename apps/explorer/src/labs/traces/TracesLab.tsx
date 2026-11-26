// One question: "What does a trace find when the game sweeps a box through the level?" Every
// move, shot and line of sight in Quake II is a trace: a box (or a point) swept from one spot to
// another through the map's brushes, stopping on the first face whose contents the caller's mask
// names. The finding is where this sweep stopped and why: how far it got, the face it met (its
// normal, and whether pmove could stand on it), and that face's contents and surface flags. The
// sweep starts at demo1's player start and is aimed by sliders held in the URL; the mask is a
// choice of the game's own callers. The stage draws the sweep in amber up to where it stopped, the
// rest of the asked path in grey and the face's normal in blue; the figures under it say the same.
import * as React from 'react';
import { ChoiceGroup, Metric, MetricStrip, PropertyList, format, useSearchParam, type Property } from 'strata-react';
import type { BspMap } from '@quake2ts/formats/bsp';
import { CONTENTS, SURFACE_FLAGS, flagNames } from '../../files/FileDetails';
import { AMBER, BLUE, GREY, LabScene, type Lines } from '../LabScene';
import { LabScreen } from '../LabScreen';
import type { Vec } from '../orbit';
import { useNumberParams, type NumberParam } from '../params';
import type { LabWorld } from '../world';
import { DEFAULT_TRACE, MASKS, sweep, type MaskKey, type TraceOutcome, type TraceSetup } from './trace';

export const TRACES_PATH = '/labs/traces';

type SetupKey = keyof TraceSetup;

export const SETUP: readonly NumberParam<SetupKey>[] = [
  { key: 'turn', param: 'turn', label: 'Turn', hint: "Degrees left of the way the player start faces; negative turns right.", min: -180, max: 180, step: 5, unit: '°' },
  { key: 'pitch', param: 'pitch', label: 'Pitch', hint: 'Degrees below level, as the game measures a look; negative looks up.', min: -89, max: 89, step: 1, unit: '°' },
  { key: 'length', param: 'length', label: 'Length', hint: 'How far the box is swept.', min: 0, max: 2048, step: 16, unit: 'u' },
  { key: 'lift', param: 'lift', label: 'Lift', hint: 'How far above the player start the sweep begins.', min: 0, max: 256, step: 8, unit: 'u' },
  { key: 'size', param: 'size', label: 'Box size', hint: "Half the box's width: 0 is a point, as a shot is traced, and 16 is the player's box.", min: 0, max: 32, step: 1, unit: 'u' },
];

/** pmove stands on a face whose normal points up more than this (MIN_STEP_NORMAL, 0.7). */
const GROUND_NORMAL = 0.7;
const STEEPEST_GROUND = (Math.acos(GROUND_NORMAL) * 180) / Math.PI;

const MASK_KEYS = Object.keys(MASKS) as MaskKey[];
const parseMask = (raw: string) => (MASK_KEYS.includes(raw as MaskKey) ? raw : undefined);

export function TracesLab() {
  const setup = useNumberParams(SETUP, DEFAULT_TRACE);
  const [mask, setMask] = useSearchParam<string>('mask', { default: 'solid', parse: parseMask });
  const maskKey = mask as MaskKey;
  return (
    <LabScreen
      title="Traces lab"
      path={TRACES_PATH}
      stageName="Sweep on demo1"
      params={SETUP}
      state={setup}
      defaults={DEFAULT_TRACE}
      defaultWords="The lab starts at"
      unchanged="A player's box swept straight ahead from the start"
      noun="setting"
      extraChanged={maskKey === 'solid' ? [] : ['what stops it']}
      extraControls={
        <ChoiceGroup
          legend="What stops it"
          name="mask"
          value={maskKey}
          onChange={setMask}
          choices={MASK_KEYS.map((k) => ({ value: k, label: MASKS[k].label, detail: MASKS[k].detail }))}
        />
      }
    >
      {({ map, world }) => <SweepView map={map} world={world} setup={setup.values} mask={maskKey} />}
    </LabScreen>
  );
}

function SweepView({ map, world, setup, mask }: { map: BspMap; world: LabWorld; setup: TraceSetup; mask: MaskKey }) {
  // Keyed on the numbers, since the values object is new on every render.
  const outcome = React.useMemo(() => sweep(world, setup, mask), [world, setup.turn, setup.pitch, setup.length, setup.lift, setup.size, mask]);
  // The first view looks along the starting sweep from behind and above its start, so the box
  // where it stops is in front of the camera; moving a slider never moves the camera.
  const home = React.useMemo(() => {
    const first = sweep(world, DEFAULT_TRACE, 'solid');
    const target = { x: (first.start.x + first.endpos.x) / 2, y: (first.start.y + first.endpos.y) / 2, z: first.start.z };
    return { target, yaw: world.start.yaw, pitch: 40, distance: 360 };
  }, [world]);
  const draw = React.useCallback((lines: Lines) => drawSweep(lines, outcome), [outcome]);

  return (
    <div className="grid gap-4 p-4">
      <LabScene
        label="The sweep in 3D"
        shows="demo1 with the sweep in amber up to where it stopped, the rest of the asked path in grey and the face it met in blue."
        legend="Amber: how far the box got and where it stopped. Grey: where it started and the rest of the way it was asked to go. Blue: the face it met, pointing out."
        map={map}
        model={world.model}
        home={home}
        draw={draw}
      />
      <MetricStrip label="What the sweep found">
        <Metric label="Got" value={format.share(outcome.fraction)} note={gotNote(outcome)} />
        <Metric label="Distance" value={format.integer.format(outcome.travelled)} unit="u" note={`Of ${format.integer.format(setup.length)} asked.`} />
        <Metric label="Face" value={outcome.slope === null ? format.missing : format.integer.format(outcome.slope)} unit={outcome.slope === null ? undefined : '°'} note={faceNote(outcome)} />
      </MetricStrip>
      <section aria-labelledby="trace-facts" className="grid gap-2">
        <h2 id="trace-facts" className="type-label">
          The trace's result
        </h2>
        <PropertyList items={facts(outcome)} />
      </section>
    </div>
  );
}

function gotNote(t: TraceOutcome): string {
  if (t.allsolid) return 'The box began inside a brush and never left it.';
  if (t.startsolid) return 'The box began inside a brush, then moved out of it.';
  return t.fraction >= 1 ? 'Nothing in the way.' : 'Stopped on the first face the mask names.';
}

function faceNote(t: TraceOutcome): string {
  if (!t.normal) return 'No face was met.';
  if (t.normal.z > GROUND_NORMAL) return `Ground: pmove stands on a face that leans less than ${format.integer.format(STEEPEST_GROUND)}°.`;
  if (t.normal.z < -GROUND_NORMAL) return 'A ceiling.';
  if (t.normal.z < 0) return 'An overhang: the face leans out over the box.';
  return `Too steep to stand on: pmove slides off anything over ${format.integer.format(STEEPEST_GROUND)}°.`;
}

// Rounded before formatting, and + 0 so a tiny negative never prints as -0.
const say = (v: Vec) => [v.x, v.y, v.z].map((n) => format.decimal.format(Math.round(n * 10) / 10 + 0)).join('  ');

function facts(t: TraceOutcome): Property[] {
  return [
    { term: 'Stopped at', value: say(t.endpos) },
    { term: 'Face normal', value: t.normal ? say(t.normal) : null },
    { term: 'Contents', value: t.fraction < 1 || t.startsolid ? flagNames(t.contents, CONTENTS) : null },
    { term: 'Surface', value: t.normal ? flagNames(t.surfaceFlags, SURFACE_FLAGS) : null },
    { term: 'Began inside', value: t.startsolid ? 'Yes' : 'No' },
    { term: 'Box', value: `${say(t.mins)}  to  ${say(t.maxs)}` },
  ];
}

const NORMAL_LENGTH = 48;

function drawSweep(lines: Lines, t: TraceOutcome) {
  lines.box(add(t.start, t.mins), add(t.start, t.maxs), GREY);
  lines.line(t.start, t.endpos, AMBER);
  if (t.fraction < 1) lines.line(t.endpos, t.end, GREY);
  lines.box(add(t.endpos, t.mins), add(t.endpos, t.maxs), AMBER);
  // A point has no box to see, so where it stopped is a small cross.
  if (t.maxs.x < 2) for (const axis of ['x', 'y', 'z'] as const) lines.line(nudge(t.endpos, axis, -MARK), nudge(t.endpos, axis, MARK), AMBER);
  if (t.normal) {
    const tip = { x: t.endpos.x + t.normal.x * NORMAL_LENGTH, y: t.endpos.y + t.normal.y * NORMAL_LENGTH, z: t.endpos.z + t.normal.z * NORMAL_LENGTH };
    lines.line(t.endpos, tip, BLUE);
  }
}

const MARK = 6;
const nudge = (v: Vec, axis: 'x' | 'y' | 'z', by: number): Vec => ({ ...v, [axis]: v[axis] + by });
const add = (a: Vec, b: Vec): Vec => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
