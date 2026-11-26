// One question: "What does pmove do when the player runs into something?" It never asks the map
// "can I go here"; it sweeps the player's box with traces. A sweep that stops on a plane takes
// the velocity's push into that plane away (PM_ClipVelocity) and sweeps again with the time left,
// up to four times a frame: that is sliding along a wall. Then it does the whole slide again from
// STEPSIZE (18 units) higher and pushes back down; if that went further, the player stepped up a
// stair. The finding is one frame of it, stopped on in the labs' player (LabPlayer; or the run
// played through like a video): each trace pmove made, what it met, and how speed and height
// came out. The run is the game's runPmove (frame.ts, a line-for-line port of p_move.cpp) from a
// place in demo1, facing a wall at an angle or a staircase, and the lab records every trace it
// asks for, which is everything pmove learns about the world.
import * as React from 'react';
import { ChoiceGroup, LineChart, Metric, MetricStrip, format, useSearchParam } from 'strata-react';
import type { BspMap } from '@quake2ts/formats/bsp';
import pmoveCpp from '../../../../../../rerelease/p_move.cpp?raw';
import pmoveC from '../../../../../../full/qcommon/pmove.c?raw';
import frameTs from '../../../../../packages/shared/src/pmove/frame.ts?raw';
import { AMBER, BLUE, GREY, LabScene, type Lines } from '../LabScene';
import { LabScreen } from '../LabScreen';
import { framePoints, type Vec } from '../orbit';
import { useNumberParams, type NumberParam } from '../params';
import { excerpt } from '../source/excerpt';
import { FurtherReading, ORIGINAL, PORT, RERELEASE, SourceCode, SourcePair } from '../source/SourceCode';
import type { LabWorld } from '../world';
import { LabPlayer, useLabClock } from '../LabPlayer';
import { DEFAULT_SLIDE, SLIDE_FRAMES, SLIDE_MSEC, runSlide, type SlideFrame, type SlidePlace, type TraceRecord } from './slide';

export const SLIDE_PATH = '/labs/slide';

type SlideKey = 'turn' | 'stepSize';
export const SLIDE_PARAMS: readonly NumberParam<SlideKey>[] = [
  { key: 'turn', param: 'turn', label: 'Turn', hint: 'Degrees left of the way the place faces; negative turns right.', min: -90, max: 90, step: 5, unit: '°' },
  { key: 'stepSize', param: 'step', label: 'Step height', hint: 'STEPSIZE: the highest ledge pmove climbs without a jump. Below a stair’s rise, the player stops at it.', min: 0, max: 48, step: 1, unit: 'u' },
];

/** Places in demo1 found by running pmove from its floors (tests/slide.test.ts checks they still do this). */
export const PLACES: Record<string, SlidePlace & { label: string; detail: string }> = {
  wall: { origin: { x: 352, y: -384, z: -73 }, yaw: 315, label: 'A wall at 45°', detail: 'By the start, running at a wall that the run meets at 45°: it slides along.' },
  stairs: { origin: { x: -192, y: 704, z: -103 }, yaw: 180, label: 'A staircase', detail: 'North-west of the start, running up six steps.' },
};
const PLACE_KEYS = Object.keys(PLACES);
const pickPlace = (raw: string) => (PLACE_KEYS.includes(raw) ? raw : undefined);
const pickFrame = (raw: string) => {
  const n = Number(raw);
  return Number.isInteger(n) && n >= 1 && n <= SLIDE_FRAMES ? raw : undefined;
};

const C_CLIP = excerpt(pmoveCpp, 'void PM_ClipVelocity(const vec3_t &in');
const C_GENERIC = excerpt(pmoveCpp, 'void PM_StepSlideMove_Generic(');
const C_STEP = excerpt(pmoveCpp, 'void PM_StepSlideMove()');
const C_STEP_1997 = excerpt(pmoveC, 'void PM_StepSlideMove (void)');
const TS_CLIP = excerpt(frameTs, 'function clipVelocity(inp: V');
const TS_GENERIC = excerpt(frameTs, 'const stepSlideMoveGeneric = (');
const TS_STEP = excerpt(frameTs, 'const stepSlideMove = () => {');

export function SlideLab() {
  const setup = useNumberParams(SLIDE_PARAMS, DEFAULT_SLIDE);
  const [place, setPlace] = useSearchParam<string>('at', { default: 'wall', parse: pickPlace });
  const [frameRaw, setFrame] = useSearchParam<string>('frame', { default: '', parse: pickFrame });
  return (
    <LabScreen
      title="Slide and step lab"
      path={SLIDE_PATH}
      stageName="One second of running, on demo1"
      params={SLIDE_PARAMS}
      state={setup}
      defaults={DEFAULT_SLIDE}
      defaultWords="The game uses"
      unchanged="Running at a wall at 45°, with the game's step height"
      noun="setting"
      extraChanged={place === 'wall' ? [] : ['the place']}
      extraControls={
        <ChoiceGroup
          legend="Where to run"
          name="at"
          value={place}
          onChange={setPlace}
          choices={PLACE_KEYS.map((k) => ({ value: k, label: PLACES[k]!.label, detail: PLACES[k]!.detail }))}
        />
      }
    >
      {({ map, world }) => (
        <SlideView map={map} world={world} place={PLACES[place]!} turn={setup.values.turn} stepSize={setup.values.stepSize} frameRaw={frameRaw} setFrame={setFrame} />
      )}
    </LabScreen>
  );
}

const SLIDE_SECONDS = SLIDE_MSEC / 1000;
/** The frame at a time on the player: frame n ends at n × 25 ms, and there is no frame 0. */
const frameOf = (t: number) => Math.min(SLIDE_FRAMES, Math.max(1, Math.round(t / SLIDE_SECONDS)));

function SlideView({
  map,
  world,
  place,
  turn,
  stepSize,
  frameRaw,
  setFrame,
}: {
  map: BspMap;
  world: LabWorld;
  place: SlidePlace;
  turn: number;
  stepSize: number;
  frameRaw: string;
  setFrame: (raw: string) => void;
}) {
  const frames = React.useMemo(() => runSlide(world, place, { turn, stepSize }), [world, place, turn, stepSize]);
  // Without a frame in the URL, the first that met a wall or stepped up: the one worth reading.
  const first = frames.find((f) => f.planes.some((n) => n.z < 0.7) || f.rise > 2) ?? frames[0]!;
  const held = frameRaw ? Number(frameRaw) : first.frame;
  // The labs' one player: frame n is at n × 25 ms, as the charts draw it, and the frame in the URL
  // is where it opens and where it is left (strata-react's media parts, through LabPlayer).
  const clock = useLabClock({
    duration: SLIDE_SECONDS * SLIDE_FRAMES,
    frame: SLIDE_SECONDS,
    held: { time: held * SLIDE_SECONDS, set: (t) => setFrame(String(frameOf(t))) },
  });
  const at = frameOf(clock.time);
  const frame = frames[at - 1]!;
  const home = React.useMemo(() => framePoints(frames.map((f) => f.after)), [frames]);
  const draw = React.useCallback((lines: Lines) => drawFrame(lines, frames, frame), [frames, frame]);
  const ms = (n: number) => `${format.integer.format(n * SLIDE_MSEC)} ms`;
  const slides = frame.traces.filter((t) => t.role === 'slide');

  return (
    <div className="grid gap-4 p-4">
      <LabPlayer clock={clock} label="The run" frame={SLIDE_SECONDS} marks={[{ time: first.frame * SLIDE_SECONDS, label: `Frame ${first.frame}, the first to meet a wall or step up` }]} />
      <p className="type-body-sm text-muted-foreground">
        Play the run's {SLIDE_FRAMES} frames ({SLIDE_MSEC} ms each), or stop on one to take it apart: the frame buttons step one. It opens on the first frame that met a wall or stepped up.
      </p>

      <LabScene
        label="The run in 3D"
        shows={`demo1 with the run's path in grey and frame ${at}: the box before it in grey, after it in amber, its sweeps in amber and the planes they met in blue.`}
        legend="Grey: the path, and the box where the frame began. Amber: each sweep as far as it got, and the box where the frame ended. Blue: the planes it met, pointing out, and the step's sweeps up and down."
        map={map}
        model={world.model}
        home={home}
        draw={draw}
      />

      <MetricStrip label={`Frame ${at}, at ${ms(at)}`}>
        <Metric label="Speed" value={format.integer.format(frame.speedAfter)} unit="u/s" note={`From ${format.integer.format(frame.speedBefore)} at the frame's start.`} />
        <Metric label="Rose" value={format.decimal.format(Math.round(frame.rise * 10) / 10 + 0)} unit="u" note={riseNote(frame, stepSize)} />
        <Metric label="Planes met" value={format.integer.format(frame.planes.length)} note={planesNote(frame)} />
        <Metric label="Traces" value={format.integer.format(frame.traces.length)} note={`${format.count(slides.length, 'sweep')} along the way, the rest up, down and around.`} />
      </MetricStrip>

      <section aria-labelledby="slide-traces" className="grid gap-2">
        <h2 id="slide-traces" className="type-label">
          Every trace frame {at} made, in order
        </h2>
        <ol className="grid gap-1 type-body-sm">
          {frame.traces.map((t, i) => (
            <li key={i} className="flex gap-2">
              <span className="w-6 shrink-0 text-end tabular-nums text-muted-foreground">{i + 1}.</span>
              <span>
                <span className="type-label">{ROLE_WORDS[t.role]}</span>: {traceWords(t)}
              </span>
            </li>
          ))}
        </ol>
      </section>

      <LineChart
        label="Speed over the run"
        series={frames.map((f) => ({ x: f.frame * SLIDE_MSEC / 1000, y: f.speedAfter }))}
        seriesLabel="Speed along the ground"
        current={(at * SLIDE_MSEC) / 1000}
        onPick={(x) => clock.seek(frameOf(x) * SLIDE_SECONDS)}
        formatX={(t) => `${format.decimal.format(t)} s`}
        xLabel="Time"
        formatY={(v) => `${format.integer.format(v)} u/s`}
        xTicks={[0, 0.25, 0.5, 0.75, 1]}
        end="none"
        readout
        height={200}
      />

      <SourcePair
        heading="Sliding: PM_ClipVelocity"
        note="A sweep that stops on a plane takes the velocity's part into the plane away, and a little more (overbounce 1.01) so the next sweep starts just off it. Into a wall at 45°, about 71% of the speed is left, along the wall."
      >
        <SourceCode title="id's C++ (2023 rerelease)" file={RERELEASE('p_move.cpp')} excerpt={C_CLIP} />
        <SourceCode title="The port" file={PORT('packages/shared/src/pmove/frame.ts')} excerpt={TS_CLIP} />
      </SourcePair>
      <SourcePair
        heading="Up to four sweeps a frame: PM_StepSlideMove_Generic"
        note="Each sweep goes as far as it can with the time left. Planes met since the last progress are kept, and the velocity is clipped to run along all of them; two make a crease to slide down, three stop the player. A velocity turned against the one the frame began with stops dead, so a corner does not jitter. The port follows the C line for line, in 32-bit floats as the C runs."
      >
        <SourceCode title="id's C++ (2023 rerelease)" file={RERELEASE('p_move.cpp')} excerpt={C_GENERIC} />
        <SourceCode title="The port" file={PORT('packages/shared/src/pmove/frame.ts')} excerpt={TS_GENERIC} />
      </SourcePair>
      <SourcePair
        heading="Stepping: PM_StepSlideMove"
        note="After the plain slide, pmove tries again from up to STEPSIZE higher, then pushes the box back down. It keeps whichever went further along the ground, unless the step lands on something too steep to stand on. The 2023 rerelease added the push down from where the step began (a stair-clip fix) and a last step down onto stairs and slopes, so running down stairs keeps the player on them; the 1997 code is below for comparison."
      >
        <SourceCode title="id's C++ (2023 rerelease)" file={RERELEASE('p_move.cpp')} excerpt={C_STEP} />
        <SourceCode title="The port" file={PORT('packages/shared/src/pmove/frame.ts')} excerpt={TS_STEP} />
        <SourceCode title="id's C (1997)" file={ORIGINAL('qcommon/pmove.c')} excerpt={C_STEP_1997} />
      </SourcePair>

      <FurtherReading
        items={[
          { title: 'Quake 2 Source Code Review', href: 'https://fabiensanglard.net/quake2', by: 'Fabien Sanglard', adds: 'where pmove sits, shared by the client and the server.' },
          { title: 'Object-Environment Collision Detection using Onion BSPs', href: 'https://accu.org/journals/overload/21/118/golodetz_1827/', by: 'Stuart Golodetz, Overload', adds: 'the traces underneath: sweeping a box through a BSP and the stepping built on it.' },
          { title: 'Graphics Programming Black Book, the Quake chapters', href: 'https://github.com/jagregory/abrash-black-book/blob/master/src/chapter-70.md', by: 'Michael Abrash', adds: 'the BSP the traces walk, from the person who built it.' },
        ]}
      />
    </div>
  );
}

const ROLE_WORDS: Record<TraceRecord['role'], string> = {
  slide: 'Sweep',
  up: 'Step up',
  down: 'Push down',
  ground: 'Ground check',
  stuck: 'Stuck check',
};

const share = (f: number) => format.share(f);

function planeWords(n: Vec): string {
  if (n.z > 0.7) return 'a floor';
  if (n.z < -0.7) return 'a ceiling';
  if (Math.abs(n.z) < 0.01) return 'a wall';
  return n.z > 0 ? 'a slope too steep to stand on' : 'an overhang';
}

function traceWords(t: TraceRecord): string {
  if (t.allsolid) return 'started inside a brush and never left it.';
  if (t.role === 'stuck') return t.startsolid ? 'the box is inside something.' : 'the box is clear where it stands.';
  if (!t.normal) return `got all the way${t.role === 'slide' ? '' : ` (${format.decimal.format(Math.round(Math.abs(t.end.z - t.start.z) * 100) / 100)} u)`}.`;
  const what = planeWords(t.normal);
  if (t.role === 'ground') return t.fraction === 0 ? `standing on ${what}: on the ground.` : `${what} ${format.decimal.format(Math.round(t.fraction * 25) / 100)} u below.`;
  const got = `got ${share(t.fraction)} of the way, then met ${what}`;
  return t.role === 'slide' ? `${got}; the velocity is clipped along it.` : `${got}.`;
}

function riseNote(f: SlideFrame, stepSize: number): string {
  if (!f.onGround) return 'In the air.';
  if (f.rise > 2) return `Up a step: pmove climbs anything up to ${format.integer.format(stepSize)} u.`;
  if (f.rise < -2) return 'Down: the rerelease steps down onto stairs and slopes.';
  return 'Level ground.';
}

function planesNote(f: SlideFrame): string {
  if (f.planes.length === 0) return 'Every sweep got all the way.';
  if (f.speedAfter < 1) return 'The velocity was clipped to nothing: stopped.';
  return 'Each took away the speed into it.';
}

const NORMAL_LENGTH = 32;
const add = (a: Vec, b: Vec): Vec => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });

function drawFrame(lines: Lines, frames: readonly SlideFrame[], frame: SlideFrame) {
  for (let i = 1; i < frames.length; i++) lines.line(frames[i - 1]!.after, frames[i]!.after, GREY);
  const box = frame.traces[0];
  if (box) {
    lines.box(add(frame.before, box.mins), add(frame.before, box.maxs), GREY);
    lines.box(add(frame.after, box.mins), add(frame.after, box.maxs), AMBER);
  }
  for (const t of frame.traces) {
    if (t.role === 'ground' || t.role === 'stuck') continue;
    const colour = t.role === 'slide' ? AMBER : BLUE;
    lines.line(t.start, t.endpos, colour);
    if (t.normal) {
      lines.line(t.endpos, add(t.endpos, { x: t.normal.x * NORMAL_LENGTH, y: t.normal.y * NORMAL_LENGTH, z: t.normal.z * NORMAL_LENGTH }), BLUE);
      lines.line(t.endpos, t.end, GREY);
    }
  }
}
