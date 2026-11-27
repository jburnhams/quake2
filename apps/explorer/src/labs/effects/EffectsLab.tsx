// One question: "What is an explosion made of?" Not a picture: a few hundred points the client
// throws out once, each with a start, a speed, a fall and a fade, worked out again every frame
// from the time alone (CL_AddParticles), plus a model played a frame a tenth of a second and a
// light that dims with it (CL_AddExplosions). The server sends only "a rocket went off here"
// (svc_temp_entity, a dozen bytes); every client makes its own sparks with rand().
// The finding is the client's own effects code (packages/client/src/cl/fx.ts), which the demo
// lockstep oracle holds to id's client particle for particle on all of demo1 (1,126,589 of them),
// fired on demo1's floor: the 3D view draws exactly what V_RenderView would hand the renderer at
// each client frame, and the sliders change what the C fixes (the particles' gravity, rand()'s
// seed, the client's frame time). It plays through the labs' one player (LabPlayer).
import * as React from 'react';
import { Field, LineChart, Metric, MetricStrip, NativeSelect, PropertyList, format, useLoad, useSearchParam, type Property } from 'strata-react';
import { loadPalette } from '@quake2ts/engine';
import type { BspMap } from '@quake2ts/formats/bsp';
import { traceBox } from '@quake2ts/shared/bsp/collision';
import { MASK_SOLID } from '@quake2ts/shared/bsp/contents';
import clFx from '../../../../../.id-source/full/client/cl_fx.c?raw';
import clTent from '../../../../../.id-source/full/client/cl_tent.c?raw';
import fxTs from '../../../../../packages/client/src/cl/fx.ts?raw';
import { useLibrary } from '../../library/context';
import { LabPlayer, useLabClock } from '../LabPlayer';
import { AMBER, GREY, LabScene, type SceneLight, type SceneParticle } from '../LabScene';
import { LabScreen } from '../LabScreen';
import type { Orbit, Vec } from '../orbit';
import { useNumberParams, type NumberParam } from '../params';
import { excerpt } from '../source/excerpt';
import { FurtherReading, ORIGINAL, PORT, SourceCode, SourcePair } from '../source/SourceCode';
import type { LabWorld } from '../world';
import { EFFECTS, EFFECT_KEYS, paletteColour, runEffect, type EffectSpot, type Run, type V3 } from './effects';

export const EFFECTS_PATH = '/labs/effects';

/** How long the lab plays: the longest of the game's effects (the boss's teleport) is gone by then. */
const DURATION = 3;

type Key = 'gravity' | 'seed' | 'frame';
const PARAMS: readonly NumberParam<Key>[] = [
  { key: 'gravity', param: 'gravity', label: 'Particle gravity', hint: 'PARTICLE_GRAVITY: how fast a falling particle speeds up, a tenth of the world\'s 800, so sparks drift.', min: 0, max: 400, step: 10, unit: 'u/s²' },
  { key: 'seed', param: 'seed', label: 'rand() seed', hint: 'Where the client\'s random numbers start: another seed throws the same effect another way.', min: 1, max: 999, step: 1 },
  { key: 'frame', param: 'frame', label: 'Client frame', hint: 'Milliseconds between client frames. A particle is worked out from the time alone, so only a trail, laid down a frame at a time, changes with it.', min: 10, max: 100, step: 5, unit: 'ms' },
];
const DEFAULTS: Readonly<Record<Key, number>> = { gravity: 40, seed: 1, frame: 25 };
const pickEffect = (raw: string) => (EFFECT_KEYS.includes(raw) ? raw : undefined);

/** The C function each effect's code section shows, and the port's method that is its port. */
const CODE: Record<string, { c: string; file: 'client/cl_fx.c' | 'client/cl_tent.c'; ts: string }> = {
  CL_ExplosionParticles: { c: 'void CL_ExplosionParticles (vec3_t org)', file: 'client/cl_fx.c', ts: 'explosionParticles(org: Vec3' },
  CL_BlasterParticles: { c: 'void CL_BlasterParticles (vec3_t org, vec3_t dir)', file: 'client/cl_fx.c', ts: 'blasterParticles(org: Vec3' },
  CL_ParticleEffect: { c: 'void CL_ParticleEffect (vec3_t org', file: 'client/cl_fx.c', ts: '  particleEffect(org: Vec3' },
  CL_RailTrail: { c: 'void CL_RailTrail (vec3_t start, vec3_t end)', file: 'client/cl_fx.c', ts: 'railTrail(start: Vec3' },
  CL_TeleportParticles: { c: 'void CL_TeleportParticles (vec3_t org)', file: 'client/cl_fx.c', ts: '  teleportParticles(org: Vec3' },
  CL_ItemRespawnParticles: { c: 'void CL_ItemRespawnParticles (vec3_t org)', file: 'client/cl_fx.c', ts: 'itemRespawnParticles(org: Vec3' },
  CL_BigTeleportParticles: { c: 'void CL_BigTeleportParticles (vec3_t org)', file: 'client/cl_fx.c', ts: 'bigTeleportParticles(org: Vec3' },
  CL_RocketTrail: { c: 'void CL_RocketTrail (vec3_t start', file: 'client/cl_fx.c', ts: 'rocketTrail(start: Vec3' },
  CL_DiminishingTrail: { c: 'void CL_DiminishingTrail (vec3_t start', file: 'client/cl_fx.c', ts: 'diminishingTrail(start: Vec3' },
};
const sourceOf = (name: string) => (name === 'client/cl_tent.c' ? clTent : clFx);

const C_ADD = excerpt(clFx, 'void CL_AddParticles (void)', { definition: true });
const TS_ADD = excerpt(fxTs, 'addParticles(): void');
const C_EXPLOSIONS = excerpt(clTent, 'void CL_AddExplosions (void)', { definition: true });
const TS_EXPLOSIONS = excerpt(fxTs, 'private addExplosions(): void');
const C_ROCKET = excerpt(clTent, 'case TE_EXPLOSION1:', { comment: false, upTo: 'break;' });
const TS_ROCKET = excerpt(fxTs, 'case t.TE_PLASMA_EXPLOSION:', { comment: false, upTo: 'break;' });

export function EffectsLab() {
  const state = useNumberParams(PARAMS, DEFAULTS);
  const [effect, setEffect] = useSearchParam<string>('effect', { default: 'rocket', parse: pickEffect });
  const changed = effect === 'rocket' ? [] : ['the effect'];
  return (
    <LabScreen
      title="Effects lab"
      path={EFFECTS_PATH}
      stageName="An effect on demo1's floor"
      params={PARAMS}
      state={state}
      defaults={DEFAULTS}
      defaultWords="The game uses"
      unchanged="A rocket going off, as the game's client draws it"
      noun="setting"
      extraChanged={changed}
      extraControls={
        <Field label="Effect" hint={EFFECTS[effect]!.detail}>
          <NativeSelect value={effect} onChange={(e) => setEffect(e.currentTarget.value)}>
            {EFFECT_KEYS.map((k) => (
              <option key={k} value={k}>
                {EFFECTS[k]!.label}
              </option>
            ))}
          </NativeSelect>
        </Field>
      }
    >
      {({ map, world }) => <EffectView map={map} world={world} effectKey={effect} gravity={state.values.gravity} seed={state.values.seed} frameMs={state.values.frame} />}
    </LabScreen>
  );
}

/** A spot on demo1's floor ahead of the player's start, and a point back and up for a trail to come from. */
export function spotFor(world: LabWorld): EffectSpot {
  const { origin, yaw } = world.start;
  const rad = (yaw * Math.PI) / 180;
  const ahead: Vec = { x: origin.x + Math.cos(rad) * 192, y: origin.y + Math.sin(rad) * 192, z: origin.z + 16 };
  const down = traceBox({ model: world.model, start: ahead, end: { ...ahead, z: ahead.z - 512 }, mins: { x: 0, y: 0, z: 0 }, maxs: { x: 0, y: 0, z: 0 }, contentMask: MASK_SOLID });
  const floor: V3 = [down.endpos.x, down.endpos.y, Math.fround(down.endpos.z + 1)];
  const normal: V3 = down.plane ? [down.plane.normal.x, down.plane.normal.y, down.plane.normal.z] : [0, 0, 1];
  return { origin: floor, normal, from: [origin.x, origin.y, Math.fround(origin.z + 22)] };
}

function EffectView({ map, world, effectKey, gravity, seed, frameMs }: { map: BspMap; world: LabWorld; effectKey: string; gravity: number; seed: number; frameMs: number }) {
  const { library } = useLibrary();
  const palette = useLoad({
    queryKey: ['palette', 'pics/colormap.pcx'],
    staleTime: Infinity,
    queryFn: () => loadPalette({ readFile: async (p: string) => new Uint8Array(await library.read(p)) }),
    describeError: () => 'pics/colormap.pcx could not be read.',
  });
  const effect = EFFECTS[effectKey]!;
  const spot = React.useMemo(() => spotFor(world), [world]);
  const run: Run = React.useMemo(() => runEffect(effect, spot, DURATION * 1000, { seed, gravity, frameMs }), [effect, spot, seed, gravity, frameMs]);
  const clock = useLabClock({ duration: DURATION, frame: frameMs / 1000 });
  const index = Math.min(run.frames.length - 1, Math.floor(clock.time * 1000 / frameMs + 1e-6));
  const frame = run.frames[index]!;

  const colours = palette.status === 'ready' ? palette.data : null;
  const particles = React.useMemo<SceneParticle[]>(
    () => frame.particles.map((p) => ({ origin: vec(p.origin), colour: colours ? paletteColour(colours, p.color, p.alpha) : [1, 0.8, 0.3, p.alpha] })),
    [frame, colours],
  );
  const lights = React.useMemo<SceneLight[]>(() => frame.lights.map((l) => ({ origin: vec(l.origin), colour: vec(l.color), intensity: l.intensity })), [frame]);
  const home = React.useMemo<Orbit>(() => ({ target: vec(spot.origin), yaw: world.start.yaw + 180, pitch: 20, distance: 260 }), [spot, world]);
  const draw = React.useCallback<React.ComponentProps<typeof LabScene>['draw']>(
    (lines) => {
      // Each model the effect draws (an explosion, smoke, a flash) as a box at its origin.
      for (const m of frame.models) {
        const o = vec(m.origin);
        lines.box({ x: o.x - 4, y: o.y - 4, z: o.z - 4 }, { x: o.x + 4, y: o.y + 4, z: o.z + 4 }, AMBER);
      }
      if (effect.fly || effectKey === 'rail') lines.line(vec(spot.from), vec(spot.origin), GREY);
    },
    [frame, effect, effectKey, spot],
  );

  const peak = Math.max(...run.frames.map((f) => f.particles.length));
  const series = run.frames.map((f) => ({ x: f.timeMs / 1000, y: f.particles.length }));
  const code = CODE[effect.code]!;
  const C_EFFECT = excerpt(sourceOf(code.file), code.c, { definition: true });
  const TS_EFFECT = excerpt(fxTs, code.ts);

  return (
    <div className="grid gap-4 p-4">
      <LabScene
        label="The effect in 3D"
        shows={`demo1's floor ahead of the start, ${format.decimal.format(frame.timeMs / 1000)} seconds after ${effect.label.toLowerCase()}: ${format.count(frame.particles.length, 'particle')}, ${format.count(frame.lights.length, 'light')}.`}
        legend="Points: the particles, in the game's palette. Amber boxes: where each model is drawn. Grey: the shot's path."
        map={map}
        model={world.model}
        home={home}
        draw={draw}
        particles={particles}
        lights={lights}
        timeSeconds={frame.timeMs / 1000}
      />

      <LabPlayer clock={clock} label="The effect" frame={frameMs / 1000} />

      <MetricStrip label={`At ${format.decimal.format(frame.timeMs / 1000)} s, client frame ${index + 1} of ${run.frames.length}`}>
        <Metric label="Particles" value={format.integer.format(frame.particles.length)} note={`Of the client's 4,096; ${format.integer.format(peak)} at most.`} />
        <Metric label="Lights" value={format.integer.format(frame.lights.length)} note={frame.lights[0] ? `Radius ${format.integer.format(Math.round(frame.lights[0].intensity))}.` : 'None now.'} />
        <Metric label="Models" value={format.integer.format(frame.models.length)} note="Explosions, smoke and flashes." />
        <Metric label="rand() draws" value={format.integer.format(run.drawsToFire)} note={`To fire it; ${format.integer.format(run.draws)} over the whole run.`} />
      </MetricStrip>

      <LineChart
        label="Particles drawn, frame by frame"
        series={series}
        seriesLabel={effect.label}
        current={frame.timeMs / 1000}
        onPick={(x) => clock.seek(Math.max(0, Math.min(DURATION, x)))}
        formatX={(s) => `${format.decimal.format(s)} s`}
        xLabel="Time"
        formatY={(v) => format.integer.format(v)}
        xTicks={[0, 0.5, 1, 1.5, 2, 2.5, 3]}
        end="none"
        readout
        height={200}
      />

      <section aria-labelledby="effect-facts" className="grid gap-2">
        <h2 id="effect-facts" className="type-label">
          What the server sent, and what the client made of it
        </h2>
        <PropertyList items={facts(effect.detail, run)} />
      </section>

      <SourcePair
        heading={`Making the particles: ${effect.code}`}
        note="Each particle gets its start, speed, fall and fade once, from rand(), and the time it was made. Nothing moves it after: the next section works out where it is from those alone."
      >
        <SourceCode title="id's C (1997)" file={ORIGINAL(code.file)} excerpt={C_EFFECT} />
        <SourceCode title="The port" file={PORT('packages/client/src/cl/fx.ts')} excerpt={TS_EFFECT} />
      </SourcePair>
      <SourcePair
        heading="Every frame: CL_AddParticles"
        note="Where a particle is now is its start plus speed times time plus acceleration times time squared, and its alpha falls by alphavel a second until it is gone. The list is walked from its newest end, so the renderer gets them in that order; the lockstep oracle checks the order too."
      >
        <SourceCode title="id's C (1997)" file={ORIGINAL('client/cl_fx.c')} excerpt={C_ADD} />
        <SourceCode title="The port" file={PORT('packages/client/src/cl/fx.ts')} excerpt={TS_ADD} />
      </SourcePair>
      <SourcePair
        heading="The model and its light: CL_AddExplosions"
        note="An explosion is a model played a frame every tenth of a second, its skin and translucency stepped as it goes, with a light whose radius is 350 times the model's alpha. It starts a tenth early (the server's frame time minus 100), so the first frame shows at once."
      >
        <SourceCode title="id's C (1997)" file={ORIGINAL('client/cl_tent.c')} excerpt={C_EXPLOSIONS} />
        <SourceCode title="The port" file={PORT('packages/client/src/cl/fx.ts')} excerpt={TS_EXPLOSIONS} />
      </SourcePair>
      <SourcePair
        heading="What a rocket's message makes: CL_ParseTEnt"
        note="The server's message is a type and a position. The client picks a model, a random yaw and a random start frame, and calls for the sparks."
      >
        <SourceCode title="id's C (1997)" file={ORIGINAL('client/cl_tent.c')} excerpt={C_ROCKET} />
        <SourceCode title="The port" file={PORT('packages/client/src/cl/fx.ts')} excerpt={TS_ROCKET} />
      </SourcePair>

      <FurtherReading
        items={[
          { title: 'Quake 2 Source Code Review: the client', href: 'https://fabiensanglard.net/quake2/index.php', by: 'Fabien Sanglard', adds: 'how the client, renderer and server split the work, and where cl_fx.c sits.' },
          { title: 'Quake 2 Source Code Review: the OpenGL renderer', href: 'https://fabiensanglard.net/quake2/quake2_opengl_renderer.php', by: 'Fabien Sanglard', adds: 'how ref_gl draws the particles the client hands it (GL_DrawParticles).' },
        ]}
      />
    </div>
  );
}

const vec = (v: readonly number[]): Vec => ({ x: v[0]!, y: v[1]!, z: v[2]! });

function facts(detail: string, run: Run): Property[] {
  const last = run.frames.findLastIndex((f) => f.particles.length > 0);
  return [
    { term: 'The message', value: detail },
    { term: 'Random numbers to make it', value: format.integer.format(run.drawsToFire) },
    { term: 'Last particle gone', value: last < 0 ? 'None made' : `${format.decimal.format(run.frames[last]!.timeMs / 1000)} s` },
    { term: 'Checked against id\'s client', value: 'Every particle, light and model of demo1, in order (the demo lockstep oracle).' },
  ];
}
