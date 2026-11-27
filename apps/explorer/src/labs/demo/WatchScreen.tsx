// One question: "What does the demo's recording show?" The finding is the recording itself, played
// back in the labs' 3D view (Jonathan, 2026-11-27: "isn't there a recording of the demo? can we
// play it through explorer?", and "should use the lookaround 3d video player setup we have in other
// labs"). The demo pak's demos/q2demo1.dm2 is the attract loop id shipped with the 3.14 demo, a
// minute on demo2 ("Installation"); the whole file is read at once (timeline.ts) so the seek bar
// goes anywhere, and the stage is LabScene with the recording's entities, driven by the labs' one
// player (LabPlayer). The camera rides the player's eyes or circles them from behind; either way a
// drag looks round on top of where the recording looks, and 0 gives the view back. The camera, the
// file and the moment (`t`, in tenths, written when playback stops) are in the URL, so a link opens
// on the same shot. Not drawn yet: muzzle flashes, explosions and other temporary effects, and the
// player's own model (the demo keeps players/ outside its PAK), which is a box here.
import * as React from 'react';
import {
  ChoiceGroup,
  ColorSchemeChoice,
  DataView,
  EmptyState,
  Field,
  Metric,
  MetricStrip,
  NativeSelect,
  Pane,
  PropertyList,
  Skeleton,
  Split,
  TextLink,
  Workspace,
  format,
  useLoad,
  useSearchParam,
  useWorkspaceState,
  type Load,
} from 'strata-react';
import { parseBsp, type BspMap } from '@quake2ts/formats/bsp';
import { useDemoPak, useLibrary } from '../../library/context';
import { LabPlayer, useLabClock } from '../LabPlayer';
import { AMBER, LabScene, type LabEntities, type LabFollow, type Lines } from '../LabScene';
import type { Orbit } from '../orbit';
import { worldFromMap, type LabWorld } from '../world';
import { FRAME_SECONDS, readDemo, viewAt, type DemoTimeline } from './timeline';

export const WATCH_PATH = '/watch';

/** The recording the page opens on: the one the 3.14 demo plays when it sits idle. */
export const DEFAULT_DEMO = 'demos/q2demo1.dm2';

export type WatchCamera = 'eyes' | 'behind';

const CAMERAS = [
  { value: 'eyes', label: "Through the player's eyes", detail: 'What the person playing saw. Drag to look round; 0 looks where they looked.' },
  { value: 'behind', label: 'Behind the player', detail: 'Circle the player as they move. Drag to go round, Control and the wheel to zoom.' },
];
const parseCamera = (v: string): WatchCamera | undefined => (v === 'eyes' || v === 'behind' ? v : undefined);

/** The person's own turn on top of the recording's: none through the eyes, a little above and behind otherwise. */
const EYES_HOME: Orbit = { target: { x: 0, y: 0, z: 0 }, yaw: 0, pitch: 0, distance: 64 };
const BEHIND_HOME: Orbit = { target: { x: 0, y: 0, z: 0 }, yaw: 0, pitch: 20, distance: 160 };

const PLAYER_MINS = { x: -16, y: -16, z: -24 };
const PLAYER_MAXS = { x: 16, y: 16, z: 32 };

type Watched = { demo: DemoTimeline; map: BspMap; world: LabWorld };

/** The demos in the open PAKs, by path. */
function useDemoFiles(): string[] {
  const { library, version } = useLibrary();
  return React.useMemo(
    () => library.vfs.findByExtension('.dm2').map((f) => f.path).sort(),
    [library, version],
  );
}

/** The recording and the map it was made on, read whole; null when no open PAK has the file. */
function useWatched(path: string): Load<Watched | null> {
  const demoPak = useDemoPak();
  const { library, version } = useLibrary();
  return useLoad({
    queryKey: ['watch', version, path],
    enabled: demoPak.status !== 'loading',
    staleTime: Infinity,
    retry: false,
    queryFn: async () => {
      if (!library.vfs.hasFile(path)) return null;
      const demo = readDemo(await library.read(path));
      if (!library.vfs.hasFile(demo.mapName)) throw new Error(`it was recorded on ${demo.mapName}, which no open PAK has`);
      const map = parseBsp(await library.read(demo.mapName));
      return { demo, map, world: worldFromMap(map) };
    },
    describeError: (e) => `${path} cannot be played: ${e instanceof Error ? e.message : String(e)}.`,
  });
}

export function WatchScreen() {
  const workspace = useWorkspaceState(WATCH_PATH);
  const files = useDemoFiles();
  const [path, setPath] = useSearchParam<string>('demo', { default: DEFAULT_DEMO });
  const [camera, setCamera] = useSearchParam<WatchCamera>('camera', { default: 'eyes', parse: parseCamera });
  const watched = useWatched(path);
  const choices = files.includes(path) ? files : [path, ...files];

  return (
    <div className="h-dvh">
      <Workspace label="Watch the demo" state={workspace} narrowBelow={720}>
        <header className="hud-bar flex min-h-(--control-h) shrink-0 flex-wrap items-center gap-3 border-b border-border px-3 py-1">
          <h1 className="type-label">Watch the demo</h1>
          <p className="type-body-sm text-muted-foreground">{path}</p>
          <div className="ms-auto flex items-center gap-2">
            <TextLink to="/explore">Explorer</TextLink>
            <ColorSchemeChoice compact />
          </div>
        </header>
        <Split direction="row">
          <Pane id="controls" name="Controls" size={320} min={260} max={480} collapsible>
            <div className="grid gap-4 p-3">
              <Field label="Recording" hint="Every .dm2 in the open PAKs. Quake 2 3.05 and later can be played; 3.00's format is not read yet.">
                <NativeSelect value={path} onChange={(e) => setPath(e.currentTarget.value)}>
                  {choices.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              <ChoiceGroup legend="Camera" name="camera" value={camera} onChange={(v) => setCamera(v as WatchCamera)} choices={CAMERAS} />
              {watched.status === 'ready' && watched.data ? <Facts demo={watched.data.demo} /> : null}
            </div>
          </Pane>
          <Pane id="stage" name="Player" grow>
            <DataView
              state={watched}
              skeleton={<StageSkeleton />}
              isEmpty={(w) => w === null}
              empty={
                <EmptyState title={`${path} is not open`}>
                  {path === DEFAULT_DEMO
                    ? "It comes with the Quake 2 3.14 demo's PAK, which the site downloads. "
                    : 'No open PAK has it. '}
                  Open a PAK that has a recording in the <TextLink to="/explore">explorer</TextLink>.
                </EmptyState>
              }
            >
              {(w) => <Player key={path} watched={w!} camera={camera} />}
            </DataView>
          </Pane>
        </Split>
      </Workspace>
    </div>
  );
}

function Facts({ demo }: { demo: DemoTimeline }) {
  return (
    <PropertyList
      items={[
        { term: 'Level', value: demo.levelName || format.missing },
        { term: 'Map', value: demo.mapName },
        { term: 'Length', value: format.decimal.format(Math.round(demo.duration * 10) / 10), unit: 's' },
        { term: 'Frames', value: format.integer.format(demo.frames.length) },
        { term: 'Protocol', value: demo.protocol },
      ]}
    />
  );
}

const parseTenths = (raw: string) => (/^\d+$/.test(raw) ? raw : undefined);

function Player({ watched, camera }: { watched: Watched; camera: WatchCamera }) {
  const { demo, map, world } = watched;
  const [moment, setMoment] = useSearchParam<string>('t', { default: '0', parse: parseTenths });
  const clock = useLabClock({
    duration: demo.duration,
    frame: FRAME_SECONDS,
    held: { time: Number(moment) / 10, set: (t) => setMoment(String(Math.round(t * 10))) },
  });
  const view = React.useMemo(() => viewAt(demo, clock.time), [demo, clock.time]);
  const eyes = camera === 'eyes';

  const entities = React.useMemo<LabEntities>(
    () => ({
      models: demo.models,
      sources: eyes ? view.entities : [...view.entities, ...view.player],
      modelName: demo.modelName,
      weapon: eyes ? view.weapon : undefined,
    }),
    [demo, view, eyes],
  );
  const follow = React.useMemo<LabFollow>(
    () => (eyes ? { target: view.eye, yaw: view.angles.y, pitch: view.angles.x } : { target: view.origin, yaw: view.angles.y }),
    [eyes, view],
  );
  const draw = React.useCallback(
    (lines: Lines) => {
      if (eyes) return;
      const o = view.origin;
      lines.box(
        { x: o.x + PLAYER_MINS.x, y: o.y + PLAYER_MINS.y, z: o.z + PLAYER_MINS.z },
        { x: o.x + PLAYER_MAXS.x, y: o.y + PLAYER_MAXS.y, z: o.z + PLAYER_MAXS.z },
        AMBER,
      );
    },
    [eyes, view.origin],
  );
  const lightStyles = React.useMemo(() => demo.lightStyles, [demo]);
  const units = (n: number, unit: string) => `${format.integer.format(Math.round(n))} ${unit}`;

  return (
    <div className="grid gap-4 p-4">
      <LabScene
        label="The recording in 3D"
        shows={eyes ? `${demo.mapName} through the recorded player's eyes.` : `${demo.mapName} from behind the recorded player, whose box is amber.`}
        legend={eyes ? 'What the player saw, as the renderer draws it.' : 'Amber: the player’s box.'}
        map={map}
        model={world.model}
        home={eyes ? EYES_HOME : BEHIND_HOME}
        draw={draw}
        standAt={eyes}
        follow={follow}
        entities={entities}
        lightStyles={lightStyles}
        timeSeconds={clock.time}
      />
      <LabPlayer clock={clock} label="The recording" frame={FRAME_SECONDS} precision="ms" />
      <MetricStrip label="The player at the playhead">
        <Metric label="Health" value={format.integer.format(view.health)} />
        <Metric label="Armour" value={format.integer.format(view.armor)} />
        <Metric label="Ammo" value={format.integer.format(view.ammo)} />
        <Metric label="Speed" value={units(view.speed, 'u/s')} />
        <Metric label="Frame" value={`${format.integer.format(view.frame + 1)} of ${format.integer.format(demo.frames.length)}`} />
      </MetricStrip>
    </div>
  );
}

function StageSkeleton() {
  return (
    <div className="grid gap-4 p-4" aria-hidden>
      <Skeleton className="aspect-video w-full" />
      <Skeleton className="h-16 w-full" />
    </div>
  );
}
