// One question: "How does a flickering light cost nothing?" qrad3 works the light out once, when
// the map is built, and stores it in lightmaps: a small picture of light for each face, one texel
// per 16 units. A light with a style gets a lightmap of its own on every face it reaches (up to
// four styles a face), and the game names each style's pattern of letters in a configstring, one
// letter a tenth of a second ('a' dark, 'm' normal, 'z' twice as bright). Each frame the client
// turns the letter into a brightness, and the renderer adds a face's lightmaps, each times its
// style's brightness. Nothing is lit again while the game runs: a flicker is a weight on a layer.
// The finding is a light of demo1's own, played letter by letter: the 3D view stands by it with the
// engine's renderer, the chart shows its pattern, and the pattern can be swapped for any other in
// the game's table or typed. The view can show the lightmaps alone, or the textures alone.
import * as React from 'react';
import { Button, ChoiceGroup, Field, Input, LineChart, Metric, MetricStrip, NativeSelect, PropertyList, Slider, format, useSearchParam, type Property } from 'strata-react';
import { DEFAULT_LIGHT_STYLES } from '@quake2ts/shared';
import type { BspMap } from '@quake2ts/formats/bsp';
import gSpawnCpp from '../../../../../../rerelease/g_spawn.cpp?raw';
import gMiscCpp from '../../../../../../rerelease/g_misc.cpp?raw';
import clFx from '../../../../../../full/client/cl_fx.c?raw';
import glLight from '../../../../../../full/ref_gl/gl_light.c?raw';
import glRsurf from '../../../../../../full/ref_gl/gl_rsurf.c?raw';
import worldspawnTs from '../../../../../packages/game/src/entities/worldspawn.ts?raw';
import lightsTs from '../../../../../packages/game/src/entities/lights.ts?raw';
import lightingTs from '../../../../../packages/engine/src/render/utils/lighting.ts?raw';
import bspPipelineTs from '../../../../../packages/engine/src/render/bspPipeline.ts?raw';
import clientTs from '../../../../../packages/client/src/index.ts?raw';
import { LabScene, type SceneLook } from '../LabScene';
import { LabScreen } from '../LabScreen';
import type { Orbit, Vec } from '../orbit';
import { useNumberParams, type NumberParam } from '../params';
import { excerpt } from '../source/excerpt';
import { FurtherReading, ORIGINAL, PORT, RERELEASE, SourceCode, SourcePair } from '../source/SourceCode';
import type { LabWorld } from '../world';
import { checkPattern, mapStyles, playPattern, type MapStyles } from './light';

export const LIGHT_PATH = '/labs/light';

/** Places in demo1 by a light with a style, where a player can stand and see what it lights. */
export const PLACES: Record<string, { eye: Vec; yaw: number; pitch: number; style: number; label: string; detail: string }> = {
  flicker: {
    eye: { x: -344, y: 60, z: -2 },
    yaw: 180,
    pitch: -10,
    style: 6,
    label: 'The flickering room',
    detail: 'West of the start: three lights of style 6, flicker (second variety).',
  },
  strobe: {
    eye: { x: 1172, y: 208, z: -10 },
    yaw: 30,
    pitch: -25,
    style: 4,
    label: 'The strobing panel',
    detail: 'East of the start: one small light of style 4, fast strobe, in the ceiling. Its glow is the patch round the panel above.',
  },
};
const PLACE_KEYS = Object.keys(PLACES);
const pickPlace = (raw: string) => (PLACE_KEYS.includes(raw) ? raw : undefined);

/** Play the place's style as a style of the table, or as the letters typed ('own'). */
const AS_CHOICES = ['place', ...[...DEFAULT_LIGHT_STYLES.keys()].map(String), 'own'];
const pickAs = (raw: string) => (AS_CHOICES.includes(raw) ? raw : undefined);
const LOOKS: readonly { value: SceneLook; label: string; detail: string }[] = [
  { value: 'lit', label: 'Textures and lightmaps', detail: 'As the game draws: each texture times its lightmaps, doubled.' },
  { value: 'lightmap', label: 'Lightmaps only', detail: 'The light alone, as qrad3 baked it, with the styles applied.' },
  { value: 'fullbright', label: 'Textures only', detail: 'No light at all: what the lightmaps add.' },
];
const pickLook = (raw: string) => (LOOKS.some((l) => l.value === raw) ? raw : undefined);

const NO_PARAMS: readonly NumberParam<never>[] = [];
const NO_DEFAULTS: Readonly<Record<never, number>> = {};

const C_TABLE = excerpt(gSpawnCpp, '// Setup light animation tables', { upTo: 'gi.configstring(CS_LIGHTS + 63, "a");' });
const TS_TABLE = excerpt(worldspawnTs, 'for (const [style, { pattern }] of DEFAULT_LIGHT_STYLES)');
const C_SET = excerpt(clFx, 'void CL_SetLightstyle (int i)');
const C_RUN = excerpt(clFx, 'void CL_RunLightStyles (void)');
const TS_SET = excerpt(clientTs, 'const applyLightStyle = (');
const TS_RUN = excerpt(lightingTs, 'export function evaluateLightStyle(');
const C_CHANGED = excerpt(glRsurf, '** check for lightmap modification', { upTo: 'goto dynamic;' });
const C_BUILD = excerpt(glLight, "memset( s_blocklights, 0, sizeof( s_blocklights[0] ) * size * 3 );", { comment: false, upTo: '// add all the dynamic lights' });
const TS_BUILD = excerpt(bspPipelineTs, '// Multi-style lightmap accumulation', { upTo: 'totalLight = light * 2.0;' });
const C_LIGHT = excerpt(gMiscCpp, 'void SP_light(edict_t *self)');
const C_LIGHT_USE = excerpt(gMiscCpp, 'USE(light_use)');
const TS_LIGHT = excerpt(lightsTs, 'export function SP_light(');

export function LightLab() {
  const none = useNumberParams(NO_PARAMS, NO_DEFAULTS);
  const [place, setPlace] = useSearchParam<string>('at', { default: 'flicker', parse: pickPlace });
  const [as, setAs] = useSearchParam<string>('as', { default: 'place', parse: pickAs });
  const [typed, setTyped] = useSearchParam<string>('pattern', { default: '' });
  const [look, setLook] = useSearchParam<string>('look', { default: 'lit', parse: pickLook });
  const here = PLACES[place]!;
  const own = DEFAULT_LIGHT_STYLES.get(here.style)!;
  const checked = as === 'own' ? checkPattern(typed) : null;
  const pattern =
    as === 'own' ? (checked && 'pattern' in checked ? checked.pattern : own.pattern) : as === 'place' ? own.pattern : DEFAULT_LIGHT_STYLES.get(Number(as))!.pattern;
  const playedAs = as === 'own' ? 'your pattern' : as === 'place' ? null : `style ${as}, ${DEFAULT_LIGHT_STYLES.get(Number(as))!.name.toLowerCase()}`;
  const changed = [...(place === 'flicker' ? [] : ['the light']), ...(as === 'place' ? [] : ['its pattern']), ...(look === 'lit' ? [] : ['the drawing'])];

  return (
    <LabScreen
      title="Light styles lab"
      path={LIGHT_PATH}
      stageName="A light of demo1's, letter by letter"
      params={NO_PARAMS}
      state={none}
      defaults={NO_DEFAULTS}
      defaultWords="The game uses"
      unchanged="demo1's flickering room, as the game plays it"
      noun="setting"
      extraChanged={changed}
      extraControls={
        <>
          <ChoiceGroup
            legend="Which light"
            name="at"
            value={place}
            onChange={setPlace}
            choices={PLACE_KEYS.map((k) => ({ value: k, label: PLACES[k]!.label, detail: PLACES[k]!.detail }))}
          />
          <Field label="Play it as" hint={`The pattern the game gives style ${here.style}, or another from its table: the style's faces keep their lightmap and take the new letters.`}>
            <NativeSelect value={as} onChange={(e) => setAs(e.currentTarget.value)}>
              <option value="place">
                Its own: style {here.style}, {own.name.toLowerCase()}
              </option>
              {[...DEFAULT_LIGHT_STYLES].map(([n, s]) => (
                <option key={n} value={String(n)}>
                  Style {n}: {s.name.toLowerCase()}
                </option>
              ))}
              <option value="own">Letters you type</option>
            </NativeSelect>
          </Field>
          {as === 'own' ? (
            <Field
              label="Pattern"
              hint="One letter a tenth of a second: a is dark, m is normal, z is twice as bright."
              error={checked && 'error' in checked ? checked.error : undefined}
            >
              <Input value={typed} onChange={(e) => setTyped(e.currentTarget.value)} spellCheck={false} autoComplete="off" className="font-mono" />
            </Field>
          ) : null}
          <ChoiceGroup legend="Draw" name="look" value={look} onChange={setLook} choices={LOOKS.map((l) => ({ ...l }))} />
        </>
      }
    >
      {({ map, world }) => <LightView map={map} world={world} placeKey={place} pattern={pattern} playedAs={playedAs} look={look as SceneLook} />}
    </LabScreen>
  );
}

function LightView({
  map,
  world,
  placeKey,
  pattern,
  playedAs,
  look,
}: {
  map: BspMap;
  world: LabWorld;
  placeKey: string;
  pattern: string;
  playedAs: string | null;
  look: SceneLook;
}) {
  const place = PLACES[placeKey]!;
  const styles = React.useMemo(() => mapStyles(map), [map]);
  const values = React.useMemo(() => playPattern(pattern), [pattern]);
  const [tenth, setTenth] = React.useState(0);
  const [playing, setPlaying] = React.useState(false);
  const at = tenth % values.length;

  // Ten letters a second while playing, as CL_RunLightStyles steps them.
  React.useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => setTenth((t) => (t + 1) % values.length), 100);
    return () => window.clearInterval(id);
  }, [playing, values.length]);
  React.useEffect(() => setTenth(0), [pattern]);

  const home = React.useMemo<Orbit>(() => ({ target: place.eye, yaw: place.yaw, pitch: place.pitch, distance: 64 }), [place]);
  const lightStyles = React.useMemo(() => [[place.style, pattern] as const], [place.style, pattern]);
  const draw = React.useCallback(() => {}, []);
  const letter = pattern[at] ?? 'm';
  const value = values[at]!;
  const seconds = values.length / 10;
  const faces = styles.faces.get(place.style) ?? 0;

  return (
    <div className="grid gap-4 p-4">
      <LabScene
        label="The light in 3D"
        shows={`demo1, standing by style ${place.style}'s lights, drawn at letter ${at + 1} of its pattern ('${letter}', ${times(value)} normal brightness).`}
        legend={`Style ${place.style} is played${playedAs ? ` as ${playedAs}` : ' as the game plays it'}; every other style as the game does.`}
        map={map}
        model={world.model}
        home={home}
        draw={draw}
        standAt
        lightStyles={lightStyles}
        timeSeconds={(at + 0.5) / 10}
        look={look}
      />

      <div className="flex flex-wrap items-end gap-3">
        <Button variant="default" onPress={() => setPlaying((p) => !p)}>
          {playing ? 'Pause the light' : 'Play the light'}
        </Button>
        <Field label="Letter" hint={place.style === 4 && !playedAs ? 'Fast strobe flashes five times a second; step through it here instead of playing it.' : 'Step through the pattern a tenth of a second at a time. Moving it pauses.'} className="min-w-64 grow">
          <Slider
            value={at + 1}
            onChange={(n) => {
              setPlaying(false);
              setTenth(n - 1);
            }}
            min={1}
            max={values.length}
            step={1}
          />
        </Field>
      </div>

      <PatternStrip pattern={pattern} at={at} />

      <MetricStrip label={`Style ${place.style}, letter ${at + 1} of ${values.length}`}>
        <Metric label="Letter" value={letter} note={`(${letter} − a) ÷ 12, as CL_SetLightstyle reads it.`} />
        <Metric label="Brightness" value={times(value)} note="Times the light qrad3 baked into its lightmap." />
        <Metric label="Loops every" value={format.decimal.format(seconds)} unit="s" note={format.count(values.length, 'letter')} />
        <Metric label="Faces it lights" value={format.integer.format(faces)} note={`Of demo1's ${format.integer.format(styles.lit)} lit faces; each keeps a lightmap of style 0 too.`} />
      </MetricStrip>

      <LineChart
        label="The pattern's brightness"
        series={steps(values)}
        seriesLabel={`Style ${place.style}`}
        current={(at + 0.5) / 10}
        onPick={(x) => {
          setPlaying(false);
          setTenth(Math.min(values.length - 1, Math.max(0, Math.floor(x * 10))));
        }}
        formatX={(t) => `${format.decimal.format(t)} s`}
        xLabel="Time"
        formatY={(v) => times(v)}
        xTicks={ticks(seconds)}
        end="none"
        readout
        height={200}
      />

      <section aria-labelledby="light-map" className="grid gap-2">
        <h2 id="light-map" className="type-label">
          demo1's light styles
        </h2>
        <PropertyList items={facts(styles)} />
      </section>

      <SourcePair
        heading="The table: SP_worldspawn"
        note="The game names each style's letters in a configstring when the map starts, so every client plays the same flicker. Before this lab the port's game set none of them, and the renderer drew every style at full: demo1's lights stood still."
      >
        <SourceCode title="id's C++ (2023 rerelease)" file={RERELEASE('g_spawn.cpp')} excerpt={C_TABLE} />
        <SourceCode title="The port" file={PORT('packages/game/src/entities/worldspawn.ts')} excerpt={TS_TABLE} />
      </SourcePair>
      <SourcePair
        heading="Letters to brightness: CL_SetLightstyle and CL_RunLightStyles"
        note="The client turns each letter into a number once, when the configstring arrives ('m' is 1), and each tenth of a second picks the letter for the time. The port's client hands the letters to the renderer, which picks the letter for the frame's time the same way."
      >
        <SourceCode title="id's C (1997)" file={ORIGINAL('client/cl_fx.c')} excerpt={C_SET} />
        <SourceCode title="id's C (1997)" file={ORIGINAL('client/cl_fx.c')} excerpt={C_RUN} />
        <SourceCode title="The port's client" file={PORT('packages/client/src/index.ts')} excerpt={TS_SET} />
        <SourceCode title="The port's renderer" file={PORT('packages/engine/src/render/utils/lighting.ts')} excerpt={TS_RUN} />
      </SourcePair>
      <SourcePair
        heading="Adding the layers: R_BuildLightMap"
        note="id's OpenGL renderer kept one lightmap texture per face: when a style's brightness changed, it added the face's layers again on the CPU, each times its style's value, and uploaded the result. The port keeps every layer in the atlas and adds them in the fragment shader each frame, then doubles the sum, as both of id's renderers do (lightmaps are stored at half)."
      >
        <SourceCode title="id's C (1997), gl_rsurf.c" file={ORIGINAL('ref_gl/gl_rsurf.c')} excerpt={C_CHANGED} />
        <SourceCode title="id's C (1997), gl_light.c" file={ORIGINAL('ref_gl/gl_light.c')} excerpt={C_BUILD} />
        <SourceCode title="The port's shader" file={PORT('packages/engine/src/render/bspPipeline.ts')} excerpt={TS_BUILD} />
      </SourcePair>
      <SourcePair
        heading="Lights that switch: SP_light"
        note="qrad3 gives a targeted light a style of its own, from 32 up; using it swaps that style's configstring between its on and off letters, so every face it lit goes dark at once. demo1 has none, but the port now does this for maps that do."
      >
        <SourceCode title="id's C++ (2023 rerelease)" file={RERELEASE('g_misc.cpp')} excerpt={C_LIGHT} />
        <SourceCode title="id's C++ (2023 rerelease)" file={RERELEASE('g_misc.cpp')} excerpt={C_LIGHT_USE} />
        <SourceCode title="The port" file={PORT('packages/game/src/entities/lights.ts')} excerpt={TS_LIGHT} />
      </SourcePair>

      <FurtherReading
        items={[
          { title: "Quake's Lighting Model: Surface Caching", href: 'https://gamedev.net/tutorials/programming/graphics/ramblings-in-realtime-chapter-4-quakes-r985', by: 'Michael Abrash, Ramblings in Realtime', adds: 'why lightmaps are 16-unit texels, and how Quake built and cached lit surfaces.' },
          { title: 'Quake 2 Source Code Review: the OpenGL renderer', href: 'https://fabiensanglard.net/quake2/quake2_opengl_renderer.php', by: 'Fabien Sanglard', adds: 'lightmaps in ref_gl, the multitexture path and the dynamic updates above.' },
          { title: 'Quake 2 PVS, Realigned Lightmaps and Colour Lightmaps', href: 'https://gamedev.net/blogs/entry/1523455-quake-2-pvs-realigned-lightmaps-and-colour-lightmaps', by: 'benryves', adds: "a loader author lining up Q2's coloured lightmaps on its faces." },
          { title: 'Get the full tech rundown on the enhanced Quake II', href: 'https://bethesda.net/en-EU/news/enhancing-quake-ii', by: 'id Software, 2023', adds: 'the remaster rebaking lightmaps at twice the density, 8 units a texel.' },
        ]}
      />
    </div>
  );
}

const times = (v: number) => `×${format.decimal.format(Math.round(v * 100) / 100)}`;

/** Each letter held for its tenth (to just short of the next, as the chart keys points by time), so the chart steps as the light does. */
function steps(values: readonly number[]): { x: number; y: number }[] {
  return values.flatMap((y, i) => [
    { x: i / 10, y },
    { x: (i + 1) / 10 - 0.001, y },
  ]);
}

function ticks(seconds: number): number[] {
  const step = seconds > 3 ? 1 : seconds > 1 ? 0.5 : 0.1;
  const out: number[] = [];
  for (let t = 0; t <= seconds + 1e-9; t += step) out.push(Math.round(t * 10) / 10);
  return out;
}

/** The pattern's letters, the one playing marked. */
function PatternStrip({ pattern, at }: { pattern: string; at: number }) {
  return (
    <p className="flex flex-wrap gap-0.5 font-mono type-body-sm" aria-label={`The pattern, ${pattern.length} letters: ${pattern}. Letter ${at + 1} is playing.`}>
      {[...pattern].map((c, i) => (
        <span key={i} aria-hidden className={i === at ? 'rounded-control bg-primary px-1 text-primary-foreground' : 'px-1 text-muted-foreground'}>
          {c}
        </span>
      ))}
    </p>
  );
}

function facts(s: MapStyles): Property[] {
  const words = (n: number) => DEFAULT_LIGHT_STYLES.get(n)?.name.toLowerCase() ?? (n >= 32 ? 'switchable' : 'not in the table');
  return [
    ...[...s.faces].map(([n, count]) => ({ term: `Style ${n}, ${words(n)}`, value: format.count(count, 'face') })),
    { term: 'Faces with two or more lightmaps', value: format.count(s.layered, 'face') },
    { term: 'Lights with a style', value: format.integer.format(s.lights.length) },
    { term: 'Lights that switch', value: format.integer.format(s.lights.filter((l) => l.targetname).length) },
  ];
}
