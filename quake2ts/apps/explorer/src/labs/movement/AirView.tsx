// The movement lab's second view: why strafing while turning in the air makes a player faster than
// pm_maxspeed. One frame of the air move is drawn from above (velocity, wish direction, the part of
// the velocity already along it, what is added and the velocity after), with the speed and the
// angle between the two on sliders; then the gain at every angle with the band where speed is
// gained; then the speed a player reaches holding the best angle; then the game's code and the
// port's, side by side. The movement constants on the left (top speed, air acceleration) change
// all of it, and the presets set them as other games in the family ship.
import * as React from 'react';
import { ButtonLink, Field, LineChart, Metric, MetricStrip, PropertyList, Slider, format } from 'strata-react';
import pmoveCpp from '../../../../../../rerelease/p_move.cpp?raw';
import frameTs from '../../../../../packages/shared/src/pmove/frame.ts?raw';
import { useNumberParams, type NumberParam } from '../params';
import { excerpt } from '../source/excerpt';
import { FurtherReading, PORT, RERELEASE, SourceCode, SourcePair } from '../source/SourceCode';
import { AIR_WISH_CAP, airFrame, bestAngle, gainBand, gainByAngle, strafeRun, type AirFrame } from './air';
import { DEFAULT_LAB_TUNING, type LabTuning } from './simulate';

type AirKey = 'speed' | 'angle' | 'msec';
const AIR_PARAMS: readonly NumberParam<AirKey>[] = [
  { key: 'speed', param: 'speed', label: 'Speed now', hint: 'How fast the player is already moving.', min: 0, max: 1000, step: 10, unit: 'u/s' },
  { key: 'angle', param: 'angle', label: 'Angle to the wish direction', hint: 'Degrees between where the player is going and where the keys push.', min: 0, max: 180, step: 1, unit: '°' },
  { key: 'msec', param: 'msec', label: 'Frame length', hint: "The usercmd's msec: how long one move lasts. A player's frame rate sets it.", min: 1, max: 100, step: 1, unit: 'ms' },
];
const AIR_DEFAULTS = { speed: 320, angle: 45, msec: 25 } as const;
const RUN_SECONDS = 3;

/** Settings from the family, as links: each sets the movement constants as that game ships them. */
const PRESETS = [
  { label: 'Quake II', query: '', says: 'sv_airaccelerate 0: PM_Accelerate at 1, top speed 300.' },
  { label: 'Quake III Arena', query: 'maxspeed=320', says: 'pm_airaccelerate 1 through PM_Accelerate, the same air move as Quake II, top speed 320.' },
  { label: 'QuakeWorld', query: 'maxspeed=320&friction=4&airaccel=10', says: 'Air acceleration 10 with the wished speed capped at 30, friction 4, top speed 320. Half-Life ships the same.' },
] as const;

const C_ACCELERATE = excerpt(pmoveCpp, 'void PM_Accelerate(const vec3_t &wishdir');
const C_AIR_ACCELERATE = excerpt(pmoveCpp, 'void PM_AirAccelerate(const vec3_t &wishdir', { comment: false });
const C_AIR_BRANCH = excerpt(pmoveCpp, '{ // not on ground, so little effect on velocity', { comment: false });
const TS_ACCELERATE = excerpt(frameTs, 'const accelerate = (wishdir');
const TS_AIR_ACCELERATE = excerpt(frameTs, 'const airAccelerate = (wishdir');
const TS_AIR_BRANCH = excerpt(frameTs, '// pm_config.airaccel (sv_airaccelerate)', { upTo: 'stepSlideMove();', comment: false });

const units = (n: number, unit: string) => `${format.integer.format(Math.round(n))} ${unit}`;
const fine = (n: number) => format.decimal.format(Math.round(n * 10) / 10 + 0);
const degrees = (n: number) => `${format.decimal.format(Math.round(n * 10) / 10)}°`;

export function AirView({ tuning, path }: { tuning: LabTuning; path: string }) {
  const air = useNumberParams(AIR_PARAMS, AIR_DEFAULTS);
  const { speed, angle, msec } = air.values;
  const frame = airFrame(speed, angle, tuning, msec);
  const best = bestAngle(speed, tuning, msec);
  const band = gainBand(speed, tuning, msec);
  const curve = React.useMemo(() => gainByAngle(speed, tuning, msec, 1), [speed, msec, ...Object.values(tuning)]);
  const run = React.useMemo(() => strafeRun(tuning, msec, RUN_SECONDS), [msec, ...Object.values(tuning)]);
  const game = React.useMemo(() => strafeRun(DEFAULT_LAB_TUNING, msec, RUN_SECONDS), [msec]);
  const gain = frame.speedAfter - frame.speedBefore;

  return (
    <div className="grid gap-6">
      <p className="type-body max-w-prose">
        In the air the keys can only add speed, and the code decides how much by looking at one number: how much of the
        velocity already points where the keys push (<code className="font-mono">currentspeed</code>, a dot product). Push
        at a wide enough angle to the way you are going and that number is small, so speed is added, sideways. The total
        grows past the {units(tuning.maxSpeed, 'u/s')} the keys ask for. Turning keeps the angle right, frame after frame:
        that is strafe-jumping.
      </p>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)]">
        <AirDiagram frame={frame} />
        <div className="grid content-start gap-4">
          {AIR_PARAMS.map((p) => (
            <Field key={p.key} label={p.label} hint={`${p.hint} The view starts at ${say(p, AIR_DEFAULTS[p.key])}.`}>
              <Slider value={air.values[p.key]} onChange={(v) => air.set(p.key, v)} min={p.min} max={p.max} step={p.step} unit={p.unit} />
            </Field>
          ))}
        </div>
      </div>

      <MetricStrip label="This frame">
        <Metric label="Gained" value={`${gain >= 0 ? '+' : ''}${fine(gain)}`} unit="u/s" note={gainNote(frame, gain)} />
        <Metric label="Best angle" value={degrees(best.angle)} note={`Gains ${fine(best.gain)} u/s a frame at this speed.`} />
        <Metric label="Gains between" value={band ? `${degrees(band.from)} – ${degrees(band.to)}` : format.missing} note={band ? 'Outside these angles the keys add nothing or slow you.' : 'No angle gains speed here.'} />
      </MetricStrip>

      <section aria-labelledby="air-numbers" className="grid gap-2">
        <h3 id="air-numbers" className="type-heading">
          The frame in {frame.path}
        </h3>
        <PropertyList
          items={[
            { term: 'wishspeed', value: fine(frame.wishspeed), unit: 'u/s' },
            ...(frame.path === 'PM_AirAccelerate' ? [{ term: 'wishspd (capped)', value: fine(frame.comparedSpeed), unit: 'u/s' }] : []),
            { term: 'currentspeed = dot(velocity, wishdir)', value: fine(frame.currentspeed), unit: 'u/s' },
            { term: 'addspeed = wish − currentspeed', value: fine(frame.addspeed), unit: 'u/s' },
            { term: `accelspeed = ${fine(frame.accel)} × ${fine(msec / 1000)} s × wishspeed, at most addspeed`, value: fine(frame.accelspeed), unit: 'u/s' },
            { term: 'Speed after', value: fine(frame.speedAfter), unit: 'u/s' },
          ]}
        />
      </section>

      <LineChart
        label="Speed gained in one frame at each angle between the velocity and the wish direction"
        series={curve.map((p) => ({ x: p.angle, y: p.gain }))}
        seriesLabel="Gain at this speed"
        spans={band ? [{ from: band.from, to: band.to, label: 'Gains speed', tone: 'success' }] : []}
        current={angle}
        formatCurrent={({ y }) => `${degrees(angle)}: ${fine(y)} u/s`}
        onPick={(x) => air.set('angle', Math.round(x))}
        formatX={degrees}
        xLabel="Angle"
        formatY={(y) => `${fine(y)} u/s`}
        xTicks={[0, 30, 60, 90, 120, 150, 180]}
        end="none"
        readout
        height={200}
      />

      <section aria-labelledby="air-run" className="grid gap-3">
        <h3 id="air-run" className="type-heading">
          Holding the best angle
        </h3>
        <p className="type-body-sm text-muted-foreground max-w-prose">
          Starting at top running speed and jumping again on the frame each jump lands (the game clears the ground in
          PM_CheckJump before PM_Friction runs, so a jump on landing loses nothing), turning each frame to keep the best
          angle. Frames last {msec} ms.
        </p>
        <MetricStrip label="After the run">
          <Metric label={`Speed after ${RUN_SECONDS} s`} value={units(run.at(-1)!.speed, 'u/s')} note={`With the game's constants: ${units(game.at(-1)!.speed, 'u/s')}.`} />
        </MetricStrip>
        <LineChart
          label="Speed over time while strafe-jumping at the best angle"
          series={run.map((p) => ({ x: p.t, y: p.speed }))}
          seriesLabel="These constants"
          planned={game.map((p) => ({ x: p.t, y: p.speed }))}
          plannedLabel="The game's constants"
          formatX={(t) => `${format.decimal.format(t)} s`}
          xLabel="Time"
          formatY={(y) => units(y, 'u/s')}
          xTicks={[0, 0.5, 1, 1.5, 2, 2.5, 3]}
          end="none"
          readout
          height={200}
        />
      </section>

      <section aria-labelledby="air-presets" className="grid gap-2">
        <h3 id="air-presets" className="type-heading">
          The same code, as other games set it
        </h3>
        <ul className="grid gap-2">
          {PRESETS.map((p) => (
            <li key={p.label} className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <ButtonLink to={`${path}?view=air${p.query ? `&${p.query}` : ''}`} size="sm">
                {p.label}
              </ButtonLink>
              <span className="type-body-sm text-muted-foreground">{p.says}</span>
            </li>
          ))}
        </ul>
      </section>

      <SourcePair
        heading="Adding speed: PM_Accelerate"
        note={
          <>
            Used on the ground at pm_accelerate, and in the air at 1 when sv_airaccelerate is 0. Nothing caps the
            result: <code className="font-mono">addspeed</code> only compares the part of the velocity along{' '}
            <code className="font-mono">wishdir</code>, never the whole speed.
          </>
        }
      >
        <SourceCode title="id's C++" file={RERELEASE('p_move.cpp')} excerpt={C_ACCELERATE} />
        <SourceCode title="The port" file={PORT('packages/shared/src/pmove/frame.ts')} excerpt={TS_ACCELERATE} />
      </SourcePair>
      <SourcePair
        heading="The capped air move: PM_AirAccelerate"
        note={`Used when sv_airaccelerate is above 0. The wished speed is capped at ${AIR_WISH_CAP} when deciding how much room is left, but not when deciding how much to add, which is why the gain band sits tight around 90°.`}
      >
        <SourceCode title="id's C++" file={RERELEASE('p_move.cpp')} excerpt={C_AIR_ACCELERATE} />
        <SourceCode title="The port" file={PORT('packages/shared/src/pmove/frame.ts')} excerpt={TS_AIR_ACCELERATE} />
      </SourcePair>
      <SourcePair
        heading="Which one the air move calls"
        note="The end of PM_AirMove. The 1997 source passes pm_accelerate to PM_AirAccelerate here; the rerelease passes sv_airaccelerate itself, and the port follows the rerelease."
      >
        <SourceCode title="id's C++" file={RERELEASE('p_move.cpp')} excerpt={C_AIR_BRANCH} />
        <SourceCode title="The port" file={PORT('packages/shared/src/pmove/frame.ts')} excerpt={TS_AIR_BRANCH} />
      </SourcePair>

      <FurtherReading
        items={[
          { title: 'Strafe Physics', href: 'https://kz-rush.com/en/page/strafe-physics', by: 'Kpoluk, kz-rush', adds: "the same functions line by line, with the gain window plotted (Half-Life's numbers)." },
          { title: 'Half-Life physics reference', href: 'https://github.com/Matherunner/hldoc', by: 'J. W. Chong', adds: 'the full derivation of the optimal strafe angle and its limits.' },
          { title: 'QW physics: air', href: 'https://quakeworld.nu/wiki/QW_physics_air', by: 'QuakeWorld.nu wiki', adds: 'the capped air move this lab sets with the QuakeWorld preset.' },
          { title: 'Bunnyhopping for noobs', href: 'https://2nafish117.github.io/2021/07/09/bunnyhopping-for-noobs.html', by: '2nafish117', adds: 'a short, readable version of the same idea.' },
          { title: "The mathematics of b-hopping", href: 'https://graffeggyfrifiadurydd.blogspot.com/2019/07/the-mathematics-of-b-hopping-you-dont.html', by: 'graffeggyfrifiadurydd', adds: 'why a jump on landing keeps its speed.' },
          { title: 'Zigzagging Through A Strange Universe', href: 'https://quake.speeddemosarchive.com/quake/qdq/articles/ZigZag/article.htm', by: 'Anthony Bailey, Quake done Quick, 1997', adds: "the speedrunners' first account of it, in Quake." },
        ]}
      />
    </div>
  );
}

function say(p: NumberParam<AirKey>, n: number) {
  return `${format.decimal.format(n)}${p.unit === '°' ? '°' : ` ${p.unit}`}`;
}

function gainNote(f: AirFrame, gain: number): string {
  if (f.addspeed <= 0) return `Nothing added: ${fine(f.currentspeed)} u/s of the velocity already points along the wish direction.`;
  if (gain > 0) return 'Speed added at an angle: the total grows.';
  return 'Speed added against the way you are going: the total falls.';
}

/** One frame from above: the velocity, the wish direction, the projection and what is added. */
function AirDiagram({ frame }: { frame: AirFrame }) {
  const W = 480;
  const H = 300;
  /** Added speed is a few units against hundreds, so it is drawn this many times longer. */
  const ZOOM = 8;
  const reach = Math.max(frame.speedBefore, frame.comparedSpeed, 50);
  const w = frame.wishdir;
  const along = (d: number) => ({ x: w.x * d, y: w.y * d });
  // Every point the diagram draws, in units, so the view fits all of them: a projection behind the
  // player (an angle over 90°) and the stretched tip included.
  const world = {
    origin: { x: 0, y: 0 },
    v: { x: frame.velocity.x, y: frame.velocity.y },
    foot: along(frame.currentspeed),
    wish: along(frame.comparedSpeed),
    addTip: { x: frame.velocity.x + w.x * frame.accelspeed * ZOOM, y: frame.velocity.y + w.y * frame.accelspeed * ZOOM },
    farWish: along(reach * 1.15),
  };
  const all = Object.values(world);
  const min = { x: Math.min(...all.map((p) => p.x)), y: Math.min(...all.map((p) => p.y)) };
  const max = { x: Math.max(...all.map((p) => p.x)), y: Math.max(...all.map((p) => p.y)) };
  const PAD = 44;
  const k = Math.min((W - 2 * PAD) / Math.max(max.x - min.x, 1), (H - 2 * PAD) / Math.max(max.y - min.y, 1));
  // Centred in the box, with +y (left of the velocity) drawn up.
  const ox = (W - (max.x - min.x) * k) / 2 - min.x * k;
  const oy = (H + (max.y - min.y) * k) / 2 + min.y * k;
  const pt = (p: { x: number; y: number }) => ({ x: ox + p.x * k, y: oy - p.y * k });
  const O = pt(world.origin);
  const v = pt(world.v);
  const foot = pt(world.foot);
  const wish = pt(world.wish);
  const addTip = pt(world.addTip);
  const farWish = pt(world.farWish);
  const id = React.useId();
  return (
    <figure className="grid gap-2">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full rounded-surface border border-border bg-card" role="img" aria-labelledby={`${id}-cap`}>
        <defs>
          <marker id={`${id}-head`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill="context-stroke" />
          </marker>
        </defs>
        {/* The wish direction, as a long line through the player. */}
        <line x1={O.x} y1={O.y} x2={farWish.x} y2={farWish.y} className="text-info" stroke="currentColor" strokeWidth={1.5} strokeDasharray="6 5" />
        <text x={farWish.x} y={farWish.y - 8} className="text-info type-caption" fill="currentColor" textAnchor="middle">
          wish direction
        </text>
        {/* The drop from the velocity's tip to the wish line, and the part of the velocity along it. */}
        <line x1={v.x} y1={v.y} x2={foot.x} y2={foot.y} className="text-muted-foreground" stroke="currentColor" strokeWidth={1} strokeDasharray="2 3" />
        <line x1={O.x} y1={O.y} x2={foot.x} y2={foot.y} className="text-info" stroke="currentColor" strokeWidth={5} strokeLinecap="round" opacity={0.55} />
        {/* How far along the wish line the keys ask for: wishspeed, or 30 on the capped path. */}
        <circle cx={wish.x} cy={wish.y} r={4} className="text-info" fill="currentColor" />
        <text x={wish.x + 8} y={wish.y + 4} className="text-info type-caption" fill="currentColor">
          {frame.path === 'PM_AirAccelerate' ? 'wishspd 30' : `wishspeed ${format.integer.format(frame.wishspeed)}`}
        </text>
        {/* Velocity before, what is added, and velocity after. */}
        <line x1={O.x} y1={O.y} x2={v.x} y2={v.y} className="text-muted-foreground" stroke="currentColor" strokeWidth={2.5} markerEnd={`url(#${id}-head)`} />
        <text x={v.x} y={v.y + 20} className="text-muted-foreground type-caption" fill="currentColor" textAnchor="end">
          velocity {format.integer.format(frame.speedBefore)}
        </text>
        {frame.accelspeed > 0 ? (
          <>
            <line x1={v.x} y1={v.y} x2={addTip.x} y2={addTip.y} className="text-primary" stroke="currentColor" strokeWidth={3} markerEnd={`url(#${id}-head)`} />
            <line x1={O.x} y1={O.y} x2={addTip.x} y2={addTip.y} className="text-primary" stroke="currentColor" strokeWidth={1.5} strokeDasharray="5 4" />
            <text
              x={addTip.x > W - 90 ? addTip.x - 10 : addTip.x + 6}
              y={addTip.y - 8}
              className="text-primary type-caption"
              fill="currentColor"
              textAnchor={addTip.x > W - 90 ? 'end' : 'start'}
            >
              +{fine(frame.accelspeed)} (×{ZOOM})
            </text>
          </>
        ) : null}
        <circle cx={O.x} cy={O.y} r={4} className="text-foreground" fill="currentColor" />
      </svg>
      <figcaption id={`${id}-cap`} className="type-caption text-muted-foreground">
        From above. Grey: the velocity, {format.integer.format(frame.speedBefore)} u/s. Blue: the wish direction, the part of the
        velocity along it ({fine(frame.currentspeed)} u/s, the thick stretch) and how far along it the keys ask for. Amber: the
        speed added this frame, {fine(frame.accelspeed)} u/s, drawn {ZOOM} times longer so it shows, and the velocity after
        (dashed, drawn to the same stretched tip).
      </figcaption>
    </figure>
  );
}
