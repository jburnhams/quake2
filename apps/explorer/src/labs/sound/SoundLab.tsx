// One question: "How does a sound get to each ear?" Not by a 3D audio engine: the client works out
// two numbers for each sound, a left and a right volume, from how far away it is and which side
// it is on (S_SpatializeOrigin), again every frame, and adds the sound into the stereo the card
// plays, scaled by them (S_PaintChannels). Nothing else: no delay between the ears, no muffling
// through walls, no echo. Behind the listener sounds the same as in front.
// The finding is the client's own mixer (packages/client/src/cl/snd.ts), which the demo lockstep
// oracle holds to id's client sample for sample over all of demo1 (1.4 million stereo samples),
// playing one of the game's sounds to a listener at demo1's start: what you hear is what id's
// client would have written to the sound card. The sliders change what the game passes with a
// sound (where it is, its volume, how fast it fades) and the player's own volume. It plays through
// the labs' one player (LabPlayer), with the browser's Web Audio playing the mixer's output.
import * as React from 'react';
import { EmptyState, Field, LineChartGroup, TextLink, Metric, MetricStrip, NativeSelect, PropertyList, Waveform, format, useLoad, useSearchParam, type Property } from 'strata-react';
import type { BspMap } from '@quake2ts/formats/bsp';
import sndDma from '../../../../../.id-source/full/client/snd_dma.c?raw';
import sndMix from '../../../../../.id-source/full/client/snd_mix.c?raw';
import sndTs from '../../../../../packages/client/src/cl/snd.ts?raw';
import { useLibrary } from '../../library/context';
import { LabPlayer, useLabClock, type LabClock } from '../LabPlayer';
import { AMBER, BLUE, GREY, LabScene, type LineColour, type Lines } from '../LabScene';
import { LabScreen } from '../LabScreen';
import type { Orbit, Vec } from '../orbit';
import { useNumberParams, type NumberParam } from '../params';
import { excerpt } from '../source/excerpt';
import { FurtherReading, ORIGINAL, PORT, SourceCode, SourcePair } from '../source/SourceCode';
import type { LabWorld } from '../world';
import { ATTENUATIONS, FULL_VOLUME, mixScene, peaks, silentPast, sourceAt, type Mix, type Path, type SoundScene } from './sound';

export const SOUND_PATH = '/labs/sound';

/** Seconds the lab plays. */
const SECONDS = 4;
const FRAME_MS = 25;

/** The game's sounds the lab offers, by their names in the pak. */
const SOUNDS = [
  {
    file: 'weapons/rockfly.wav',
    label: 'Rocket in flight',
    detail: 'The hiss a rocket carries as it flies (rocket_touch stops it).',
  },
  {
    file: 'weapons/ROCKLX1A.WAV',
    label: 'Rocket explosion',
    detail: 'What the rocket makes when it hits.',
  },
  { file: 'weapons/RAILGF1A.WAV', label: 'Railgun', detail: 'The railgun firing.' },
  { file: 'doors/dr1_strt.wav', label: 'Door', detail: 'A door starting to open.' },
  { file: 'items/pkup.wav', label: 'Pickup', detail: 'Picking up an item.' },
  { file: 'world/comp_hum1.wav', label: 'Computer hum', detail: "One of the maps' ambient hums." },
] as const;
const SOUND_FILES: readonly string[] = SOUNDS.map((s) => s.file);
const PATHS: readonly { key: Path; label: string; detail: string }[] = [
  {
    key: 'round',
    label: 'Going round you',
    detail: 'Once round the listener in the four seconds, starting at the bearing: hear it cross from ear to ear.',
  },
  { key: 'still', label: 'Standing still', detail: 'At the bearing and distance, the whole time.' },
];

type Key = 'distance' | 'bearing' | 'volume' | 'master';
const PARAMS: readonly NumberParam<Key>[] = [
  {
    key: 'distance',
    param: 'distance',
    label: 'Distance',
    hint: 'Units from the listener. Within 80 (SOUND_FULLVOLUME) nothing is lost to distance.',
    min: 0,
    max: 2500,
    step: 10,
    unit: 'u',
  },
  {
    key: 'bearing',
    param: 'bearing',
    label: 'Bearing',
    hint: 'Degrees round from straight ahead, to the left: 90 is the left ear, -90 the right, 180 behind.',
    min: -180,
    max: 180,
    step: 5,
    unit: '°',
  },
  {
    key: 'volume',
    param: 'volume',
    label: 'Sound volume',
    hint: 'What the game passes with the sound, 0 to 1 (the server sends it as a byte).',
    min: 0,
    max: 1,
    step: 0.05,
  },
  {
    key: 'master',
    param: 'master',
    label: 'Player volume',
    hint: "s_volume: the player's own setting, 0.7 unless they change it. It picks the mixer's scale table.",
    min: 0,
    max: 1,
    step: 0.05,
  },
];
const DEFAULTS: Readonly<Record<Key, number>> = {
  distance: 300,
  bearing: 90,
  volume: 1,
  master: 0.7,
};

const pickSound = (raw: string) => (SOUND_FILES.includes(raw) ? raw : undefined);
const pickAttn = (raw: string) => (ATTENUATIONS.some((a) => a.key === raw) ? raw : undefined);
const pickPath = (raw: string) => (PATHS.some((p) => p.key === raw) ? (raw as Path) : undefined);
const pickBits = (raw: string) => (raw === '8' || raw === '16' ? raw : undefined);

const C_SPATIALIZE = excerpt(sndDma, 'void S_SpatializeOrigin (vec3_t origin', {
  definition: true,
});
const TS_SPATIALIZE = excerpt(sndTs, 'private spatializeOrigin(');
const C_FROM8 = excerpt(sndMix, 'void S_PaintChannelFrom8 (channel_t *ch, sfxcache_t *sc, int count, int offset)', { definition: true });
const TS_FROM8 = excerpt(sndTs, 'private paintChannelFrom8(');
const C_SCALETABLE = excerpt(sndMix, 'void S_InitScaletable (void)', { definition: true });
const TS_SCALETABLE = excerpt(sndTs, 'private initScaletable(');
const C_TRANSFER = excerpt(sndMix, 'void S_TransferStereo16 (unsigned long *pbuf, int endtime)', {
  definition: true,
});
const TS_TRANSFER = excerpt(sndTs, 'private transferStereo16(');

export function SoundLab() {
  const state = useNumberParams(PARAMS, DEFAULTS);
  const [sound, setSound] = useSearchParam<string>('sound', {
    default: SOUNDS[0].file,
    parse: pickSound,
  });
  const [attn, setAttn] = useSearchParam<string>('attenuation', {
    default: 'norm',
    parse: pickAttn,
  });
  const [path, setPath] = useSearchParam<Path>('path', { default: 'round', parse: pickPath });
  const [bits, setBits] = useSearchParam<string>('bits', { default: '8', parse: pickBits });
  const changed = [
    ...(sound !== SOUNDS[0].file ? ['the sound'] : []),
    ...(attn !== 'norm' ? ['the attenuation'] : []),
    ...(path !== 'round' ? ['the path'] : []),
    ...(bits !== '8' ? ['the sample size'] : []),
  ];
  const attenuation = ATTENUATIONS.find((a) => a.key === attn)!;
  return (
    <LabScreen
      title="Sound lab"
      path={SOUND_PATH}
      stageName="A sound at demo1's start"
      params={PARAMS}
      state={state}
      defaults={DEFAULTS}
      defaultWords="The game uses"
      unchanged="A rocket flying round the player, as the game's mixer plays it"
      noun="setting"
      extraChanged={changed}
      extraControls={
        <>
          <Field label="Sound" hint={SOUNDS.find((s) => s.file === sound)!.detail}>
            <NativeSelect value={sound} onChange={(e) => setSound(e.currentTarget.value)}>
              {SOUNDS.map((s) => (
                <option key={s.file} value={s.file}>
                  {s.label}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Attenuation" hint={attenuation.detail}>
            <NativeSelect value={attn} onChange={(e) => setAttn(e.currentTarget.value)}>
              {ATTENUATIONS.map((a) => (
                <option key={a.key} value={a.key}>
                  {a.label}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Path" hint={PATHS.find((p) => p.key === path)!.detail}>
            <NativeSelect value={path} onChange={(e) => setPath(e.currentTarget.value as Path)}>
              {PATHS.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.label}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field
            label="Sample size"
            hint="s_loadas8bit: the game keeps every sound as 8 bits a sample unless the player turns it off, to save memory. 8-bit sounds go through a table of 32 volume steps."
          >
            <NativeSelect value={bits} onChange={(e) => setBits(e.currentTarget.value)}>
              <option value="8">8 bits (the game's default)</option>
              <option value="16">16 bits</option>
            </NativeSelect>
          </Field>
        </>
      }
    >
      {({ map, world }) => (
        <SoundView
          map={map}
          world={world}
          file={sound}
          onPlace={(distance, bearing) => state.setMany({ distance, bearing })}
          scene={{
            distance: state.values.distance,
            bearing: state.values.bearing,
            path,
            attenuation: attenuation.value,
            volume: state.values.volume,
            master: state.values.master,
            eightBit: bits === '8',
            seconds: SECONDS,
            frameMs: FRAME_MS,
          }}
        />
      )}
    </LabScreen>
  );
}

function SoundView({ map, world, file, scene, onPlace }: { map: BspMap; world: LabWorld; file: string; scene: Omit<SoundScene, 'wav'>; onPlace: (distance: number, bearing: number) => void }) {
  const { library } = useLibrary();
  const wav = useLoad({
    queryKey: ['sound', file],
    staleTime: Infinity,
    // null when the PAK open has no such sound (the demo's has them all)
    queryFn: async () =>
      library.read(`sound/${file}`).then(
        (b) => new Uint8Array(b),
        () => null,
      ),
    describeError: () => `sound/${file} could not be read.`,
  });
  const { distance, bearing, path, attenuation, volume, master, eightBit } = scene;
  const mix = React.useMemo(
    () =>
      wav.status === 'ready' && wav.data
        ? mixScene({
            wav: wav.data,
            distance,
            bearing,
            path,
            attenuation,
            volume,
            master,
            eightBit,
            seconds: SECONDS,
            frameMs: FRAME_MS,
          })
        : null,
    [wav.status, wav.status === 'ready' ? wav.data : null, distance, bearing, path, attenuation, volume, master, eightBit],
  );
  const clock = useLabClock({ duration: SECONDS, frame: FRAME_MS / 1000 });
  useMixAudio(mix, clock);

  // The listener at the player's start, eye high, facing the start's way; the mix's +x is that way.
  const eye: Vec = {
    x: world.start.origin.x,
    y: world.start.origin.y,
    z: world.start.origin.z + 22,
  };
  const yaw = (world.start.yaw * Math.PI) / 180;
  const toWorld = React.useCallback(
    (p: readonly number[]): Vec => ({
      x: eye.x + Math.cos(yaw) * p[0]! - Math.sin(yaw) * p[1]!,
      y: eye.y + Math.sin(yaw) * p[0]! + Math.cos(yaw) * p[1]!,
      z: eye.z + p[2]!,
    }),
    [eye.x, eye.y, eye.z, yaw],
  );
  const timeMs = clock.time * 1000;
  const index = Math.min((mix?.frames.length ?? 1) - 1, Math.floor(timeMs / FRAME_MS + 1e-6));
  const frame = mix?.frames[index];
  const at = sourceAt({ ...scene }, timeMs);
  const silent = silentPast(attenuation);

  const home = React.useMemo<Orbit>(() => {
    // behind and above the listener, inside the start room, looking the way they face
    return { target: eye, yaw: world.start.yaw, pitch: 35, distance: 200 };
  }, [eye.x, eye.y, eye.z, world.start.yaw]);
  const draw = React.useCallback(
    (lines: Lines) => {
      ring(lines, toWorld, FULL_VOLUME, GREY);
      if (silent !== null && silent < 3000) ring(lines, toWorld, silent, BLUE);
      if (path === 'round') ring(lines, toWorld, distance, { ...AMBER, a: 0.35 });
      // the listener: a box, and a line the way they face
      lines.box({ x: eye.x - 6, y: eye.y - 6, z: eye.z - 6 }, { x: eye.x + 6, y: eye.y + 6, z: eye.z + 6 }, GREY);
      lines.line(eye, toWorld([40, 0, 0]), GREY);
      const s = toWorld(at);
      lines.box({ x: s.x - 8, y: s.y - 8, z: s.z - 8 }, { x: s.x + 8, y: s.y + 8, z: s.z + 8 }, AMBER);
      lines.line(eye, s, { ...AMBER, a: 0.6 });
    },
    [toWorld, silent, path, distance, eye.x, eye.y, eye.z, at[0], at[1]],
  );

  const sayVol = (v: number) => `${format.integer.format(v)} of 255`;
  return (
    <div className="grid gap-4 p-4">
      <LabScene
        label="The sound and the listener in 3D"
        shows={`demo1's start from above: the listener facing the way the player starts, and the sound ${format.integer.format(Math.round(Math.hypot(at[0], at[1])))} units away${frame ? `, at left ${sayVol(frame.left)} and right ${sayVol(frame.right)}` : ''}.`}
        legend={`Amber: the sound${path === 'round' ? ' and its path' : ''}. Grey: the listener, the way they face, and the 80-unit ring inside which nothing is lost to distance. Blue: where the sound goes silent${silent === null ? ' (never, without attenuation)' : ''}.`}
        map={map}
        model={world.model}
        home={home}
        draw={draw}
      />

      <LabPlayer clock={clock} label="The sound" frame={FRAME_MS / 1000} />

      {mix && frame ? (
        <MixView mix={mix} clock={clock} index={index} scene={scene} at={at} onPlace={onPlace} />
      ) : wav.status === 'ready' ? (
        <EmptyState title={`This PAK has no sound/${file}`}>
          The sound is in the demo's PAK. Open it, or a PAK that has the sound, in the <TextLink to="/explore">explorer</TextLink>, or pick another sound.
        </EmptyState>
      ) : (
        <p className="type-body-sm text-muted-foreground">Reading sound/{file}.</p>
      )}

      <SourcePair
        heading="Two numbers for each sound: S_SpatializeOrigin"
        note="Distance past 80 units, times dist_mult (the attenuation over 2,000; over 1,000 for static), takes a share off both ears. Which side it is on is the dot product of the direction to the sound with the listener's right: straight ahead or behind is half in each ear, on the right all in the right. That is the whole of the game's 3D sound."
      >
        <SourceCode title="id's C (1997)" file={ORIGINAL('client/snd_dma.c')} excerpt={C_SPATIALIZE} />
        <SourceCode title="The port" file={PORT('packages/client/src/cl/snd.ts')} excerpt={TS_SPATIALIZE} />
      </SourcePair>
      <SourcePair
        heading="32 volume steps: S_InitScaletable"
        note="An 8-bit sample is looked up, not multiplied: a table of each of the 256 sample values at 32 volumes, built again whenever the player's volume changes. A channel's 0 to 255 picks its row by its top five bits."
      >
        <SourceCode title="id's C (1997)" file={ORIGINAL('client/snd_mix.c')} excerpt={C_SCALETABLE} />
        <SourceCode title="The port" file={PORT('packages/client/src/cl/snd.ts')} excerpt={TS_SCALETABLE} />
      </SourcePair>
      <SourcePair
        heading="Adding a sound in: S_PaintChannelFrom8"
        note="id's C takes the row as volume >> 11, which is always row 0, so built from this C every 8-bit sound is silent. The game id shipped never ran it: on x86 it ran snd_mixa.s, whose row is volume >> 3. The port does what the assembly did, and the lockstep oracle builds id's client with the assembly's rule, so the two agree on every sample."
      >
        <SourceCode title="id's C (1997)" file={ORIGINAL('client/snd_mix.c')} excerpt={C_FROM8} />
        <SourceCode title="The port" file={PORT('packages/client/src/cl/snd.ts')} excerpt={TS_FROM8} />
      </SourcePair>
      <SourcePair
        heading="To the sound card: S_TransferStereo16"
        note="Every channel is added into one buffer of wide sums, then each sum is cut to 16 bits as it goes to the card's ring: two loud sounds together clip rather than get quieter."
      >
        <SourceCode title="id's C (1997)" file={ORIGINAL('client/snd_mix.c')} excerpt={C_TRANSFER} />
        <SourceCode title="The port" file={PORT('packages/client/src/cl/snd.ts')} excerpt={TS_TRANSFER} />
      </SourcePair>

      <FurtherReading
        items={[
          {
            title: 'Quake 2 Source Code Review',
            href: 'https://fabiensanglard.net/quake2/index.php',
            by: 'Fabien Sanglard',
            adds: 'where the sound system sits beside the client and the renderer.',
          },
        ]}
      />
    </div>
  );
}

/** A circle of `radius` round the listener, flat at eye height. */
function ring(lines: Lines, toWorld: (p: readonly number[]) => Vec, radius: number, colour: LineColour) {
  const n = 48;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const b = ((i + 1) / n) * Math.PI * 2;
    lines.line(toWorld([Math.cos(a) * radius, Math.sin(a) * radius, 0]), toWorld([Math.cos(b) * radius, Math.sin(b) * radius, 0]), colour);
  }
}

function MixView({
  mix,
  clock,
  index,
  scene,
  at,
  onPlace,
}: {
  mix: Mix;
  clock: LabClock;
  index: number;
  scene: Omit<SoundScene, 'wav'>;
  at: readonly number[];
  onPlace: (distance: number, bearing: number) => void;
}) {
  const frame = mix.frames[index]!;
  const leftPeaks = React.useMemo(() => peaks(mix.left, 800), [mix]);
  const rightPeaks = React.useMemo(() => peaks(mix.right, 800), [mix]);
  const seek = (t: number) => clock.seek(Math.max(0, Math.min(SECONDS, t)));
  const leftSeries = mix.frames.map((f) => ({ x: f.timeMs / 1000, y: f.left }));
  const rightSeries = mix.frames.map((f) => ({ x: f.timeMs / 1000, y: f.right }));
  const ticks = [0, 1, 2, 3, 4];
  const secs = (s: number) => `${format.decimal.format(s)} s`;
  return (
    <>
      <div className="grid items-start gap-4 md:grid-cols-3">
        <Radar scene={scene} at={at} onPlace={onPlace} />
        <MetricStrip className="md:col-span-2" label={`At ${secs(frame.timeMs / 1000)}, client frame ${index + 1} of ${mix.frames.length}`}>
          <Metric label="Left ear" value={format.integer.format(frame.left)} note="Of 255: the channel's leftvol." />
          <Metric label="Right ear" value={format.integer.format(frame.right)} note="Of 255: the channel's rightvol." />
          <Metric
            label="Distance"
            value={`${format.integer.format(Math.round(Math.hypot(frame.origin[0], frame.origin[1])))} u`}
            note={scene.distance <= FULL_VOLUME ? 'Inside the full-volume ring.' : 'From the listener.'}
          />
          <Metric label="Clipped" value={format.integer.format(mix.clipped)} note="Samples the mix cut at 16 bits." />
        </MetricStrip>
      </div>

      <section aria-labelledby="sound-out" className="grid gap-2">
        <h2 id="sound-out" className="type-label">
          What the mixer wrote to the sound card
        </h2>
        <p className="type-caption text-muted-foreground">Left channel</p>
        <Waveform label="The left channel" peaks={leftPeaks} duration={SECONDS} time={clock.time} onSeek={seek} step={0.1} bigStep={1} />
        <p className="type-caption text-muted-foreground">Right channel</p>
        <Waveform label="The right channel" peaks={rightPeaks} duration={SECONDS} time={clock.time} onSeek={seek} step={0.1} bigStep={1} />
      </section>

      <LineChartGroup
        label="The volume the mixer gave each ear, frame by frame"
        charts={[
          {
            series: leftSeries,
            seriesLabel: 'Left ear',
            formatY: (v) => format.integer.format(v),
            yMin: 0,
            yMax: 255,
            end: 'none',
            height: 140,
          },
          {
            series: rightSeries,
            seriesLabel: 'Right ear',
            formatY: (v) => format.integer.format(v),
            yMin: 0,
            yMax: 255,
            end: 'none',
            height: 140,
          },
        ]}
        formatX={secs}
        xLabel="Time"
        xTicks={ticks}
        current={frame.timeMs / 1000}
        onPick={seek}
      />

      <section aria-labelledby="sound-facts" className="grid gap-2">
        <h2 id="sound-facts" className="type-label">
          How the mixer holds the sound
        </h2>
        <PropertyList items={facts(mix, scene)} />
      </section>
    </>
  );
}

function facts(mix: Mix, scene: Omit<SoundScene, 'wav'>): Property[] {
  const s = mix.stored;
  const plays = mix.frames.filter((f) => f.started).length;
  return [
    {
      term: 'In the pak',
      value: `${format.integer.format(s.sourceRate)} Hz, ${s.sourceWidth * 8}-bit, mono`,
    },
    {
      term: 'In the mixer',
      value: `${format.integer.format(s.samples)} samples at ${format.integer.format(mix.rate)} Hz, ${s.width * 8}-bit${scene.eightBit && s.sourceWidth === 2 ? ' (cut to 8 bits on loading)' : ''}`,
    },
    {
      term: 'Played',
      value: plays === 1 ? 'Once' : `${format.integer.format(plays)} times, started again each time it ended`,
    },
    {
      term: 'Mixed ahead',
      value: 'A fifth of a second (s_mixahead): a moving sound is heard where it was when that stretch was mixed.',
    },
    {
      term: "Checked against id's client",
      value: 'Every sound start, channel and sample of demo1 (the demo lockstep oracle).',
    },
  ];
}

/** Plays the mix through Web Audio while the clock plays, from the clock's time, at its speed. */
function useMixAudio(mix: Mix | null, clock: LabClock) {
  const ctx = React.useRef<AudioContext | null>(null);
  const time = React.useRef(clock.time);
  time.current = clock.time;
  React.useEffect(() => {
    if (!clock.playing || !mix) return;
    const Ctx = typeof window === 'undefined' ? undefined : window.AudioContext;
    if (!Ctx) return;
    const audio = (ctx.current ??= new Ctx());
    void audio.resume();
    const buffer = audio.createBuffer(2, mix.left.length, mix.rate);
    const [l, r] = [buffer.getChannelData(0), buffer.getChannelData(1)];
    for (let i = 0; i < mix.left.length; i++) {
      l[i] = mix.left[i]! / 32768;
      r[i] = mix.right[i]! / 32768;
    }
    const source = audio.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = clock.rate;
    source.connect(audio.destination);
    source.start(0, Math.min(time.current, SECONDS));
    return () => {
      source.stop();
      source.disconnect();
    };
  }, [clock.playing, clock.rate, mix]);
  React.useEffect(() => () => void ctx.current?.close(), []);
}

/**
 * The scene from above, the listener's forward up the page: the sound, its path, the full-volume
 * ring and where it goes silent. A click puts the sound there (the Distance and Bearing sliders do
 * the same from the keyboard).
 */
function Radar({ scene, at, onPlace }: { scene: Omit<SoundScene, 'wav'>; at: readonly number[]; onPlace: (distance: number, bearing: number) => void }) {
  const silent = silentPast(scene.attenuation);
  const reach = Math.max(scene.distance, FULL_VOLUME) * 1.25;
  const R = Math.max(160, Math.min(2500, reach));
  // world (x forward, y left) to the page (x right, y down), in units
  const px = (p: readonly number[]) => ({ x: -p[1]!, y: -p[0]! });
  const s = px(at);
  const place = (e: React.MouseEvent<SVGSVGElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - box.left) / box.width - 0.5) * 2 * R;
    const y = ((e.clientY - box.top) / box.height - 0.5) * 2 * R;
    const distance = Math.min(2500, Math.round(Math.hypot(x, y) / 10) * 10);
    const bearing = Math.round((Math.atan2(-x, -y) * 180) / Math.PI / 5) * 5;
    onPlace(distance, bearing === -180 ? 180 : bearing);
  };
  return (
    <figure className="grid gap-2">
      <svg
        viewBox={`${-R} ${-R} ${2 * R} ${2 * R}`}
        className="aspect-square w-full cursor-crosshair rounded-surface border border-border bg-surface-sunken"
        role="img"
        aria-label={`From above: the sound ${format.integer.format(Math.round(Math.hypot(at[0]!, at[1]!)))} units away, ${side(at)}.`}
        onClick={place}
      >
        <g fill="none" vectorEffect="non-scaling-stroke">
          {silent !== null && silent < R ? <circle r={silent} className="stroke-info" strokeWidth={R / 100} strokeDasharray={`${R / 30} ${R / 30}`} /> : null}
          {scene.path === 'round' ? <circle r={scene.distance} className="stroke-primary" strokeOpacity={0.4} strokeWidth={R / 120} /> : null}
          <circle r={FULL_VOLUME} className="stroke-muted-foreground" strokeWidth={R / 120} />
          <line x1={0} y1={0} x2={0} y2={-R * 0.15} className="stroke-foreground" strokeWidth={R / 80} />
          <line x1={0} y1={0} x2={s.x} y2={s.y} className="stroke-primary" strokeOpacity={0.6} strokeWidth={R / 160} />
        </g>
        <circle r={R / 40} className="fill-foreground" />
        <circle cx={s.x} cy={s.y} r={R / 25} className="fill-primary" />
      </svg>
      <figcaption className="type-caption text-muted-foreground">From above, facing up the page. Click to put the sound there. Grey ring: 80 units; dashed: where it goes silent.</figcaption>
    </figure>
  );
}

/** Which side a point is on, in words. */
function side(p: readonly number[]): string {
  const deg = (Math.atan2(p[1]!, p[0]!) * 180) / Math.PI;
  const a = Math.abs(deg);
  if (a < 22.5) return 'ahead';
  if (a > 157.5) return 'behind';
  const lr = deg > 0 ? 'left' : 'right';
  return a < 67.5 ? `ahead and to the ${lr}` : a > 112.5 ? `behind and to the ${lr}` : `to the ${lr}`;
}
