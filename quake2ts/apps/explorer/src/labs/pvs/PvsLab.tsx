// One question: "What does the renderer draw from here, and why not the rest?" Quake II never
// works out what is in sight while it runs. qbsp cuts the level into leaves, vis groups them into
// clusters and stores, for each cluster, a bit for every cluster that could be seen from anywhere
// in it (the potentially visible set). Each frame the renderer finds the eye's leaf, reads its
// cluster's row and draws only the leaves whose cluster bit is set; doors then cut off the areas
// behind them. The finding is how little of the level that leaves: the eye's cluster, how many of
// demo1's 1,391 clusters its row names, and the faces drawn of all the world's. The eye is held in
// the URL and moved by a click on the plan or by the sliders; the door choice opens or closes
// demo1's one area portal. The 3D view stands the engine's renderer at the eye, so what it shows is
// the same cull, and turning round shows where the PVS ends.
import * as React from 'react';
import { ButtonLink, ChoiceGroup, Metric, MetricStrip, PropertyList, format, useSearchParam, type Property } from 'strata-react';
import type { BspMap } from '@quake2ts/formats/bsp';
import glModel from '../../../../../../full/ref_gl/gl_model.c?raw';
import glRmain from '../../../../../../full/ref_gl/gl_rmain.c?raw';
import glRsurf from '../../../../../../full/ref_gl/gl_rsurf.c?raw';
import cmodel from '../../../../../../full/qcommon/cmodel.c?raw';
import traversalTs from '../../../../../packages/engine/src/render/bspTraversal.ts?raw';
import formatsBsp from '../../../../../packages/formats/src/bsp.ts?raw';
import { AMBER, LabScene, type Lines } from '../LabScene';
import { LabScreen } from '../LabScreen';
import { useNumberParams, type NumberParam } from '../params';
import { excerpt } from '../source/excerpt';
import { FurtherReading, ORIGINAL, PORT, SourceCode, SourcePair } from '../source/SourceCode';
import type { LabWorld } from '../world';
import { mapFloors, mapPortals, viewFrom, type PvsView } from './pvs';
import { PvsPlan } from './PvsPlan';

export const PVS_PATH = '/labs/pvs';

type EyeKey = 'x' | 'y' | 'z' | 'yaw';

/** demo1's bounds, a little wider, so any point of the level can be set. */
export const EYE_PARAMS: readonly NumberParam<EyeKey>[] = [
  { key: 'x', param: 'x', label: 'East', hint: 'Where the eye is along the map, west to east.', min: -2200, max: 1480, step: 1, unit: 'u' },
  { key: 'y', param: 'y', label: 'North', hint: 'Where the eye is across the map, south to north.', min: -1560, max: 2010, step: 1, unit: 'u' },
  { key: 'z', param: 'z', label: 'Height', hint: 'How high the eye is. A click on a floor puts it 46 units above it, a standing player’s eye.', min: -470, max: 610, step: 1, unit: 'u' },
  { key: 'yaw', param: 'yaw', label: 'Facing', hint: 'The way the 3D view starts out looking, as a Quake yaw: 0 is east, 90 north. Dragging the view turns it from there.', min: -180, max: 180, step: 5, unit: '°' },
];

/** demo1's player start, at eye height, facing as it does. */
const START: Record<EyeKey, number> = { x: 144, y: -336, z: 41 + 22, yaw: 135 };
/** Just east of the door (*8) into the second area, looking at it. */
const BY_THE_DOOR = { x: -1040, y: 1632, z: -2, yaw: 180 };

const DOORS = ['closed', 'open'];
const pickDoor = (raw: string) => (DOORS.includes(raw) ? raw : undefined);

const C_POINT = excerpt(glModel, 'mleaf_t *Mod_PointInLeaf (vec3_t p, model_t *model)');
const C_DECOMPRESS = excerpt(glModel, 'byte *Mod_DecompressVis (byte *in, model_t *model)');
const C_SETUP = excerpt(glRmain, 'if ( !( r_newrefdef.rdflags & RDF_NOWORLDMODEL ) )');
const C_MARK = excerpt(glRsurf, 'void R_MarkLeaves (void)');
const C_AREACHECK = excerpt(glRsurf, '// check for door connected areas', { comment: false, upTo: 'return;' });
const C_FLOOD = excerpt(cmodel, 'void FloodArea_r (carea_t *area, int floodnum)');
const C_AREABITS = excerpt(cmodel, 'int CM_WriteAreaBits (byte *buffer, int area)');
const TS_POINT = excerpt(traversalTs, 'export function findLeafForPoint(');
const TS_DECOMPRESS = excerpt(formatsBsp, 'function decompressVis(');
const TS_VISIBLE = excerpt(traversalTs, 'export function isClusterVisible(');
const TS_TRAVERSE = excerpt(traversalTs, 'function traverse(');
const TS_AREAS = excerpt(traversalTs, 'export function calculateReachableAreas(');

const href = (eye: Record<EyeKey, number>) => `${PVS_PATH}?x=${eye.x}&y=${eye.y}&z=${eye.z}&yaw=${eye.yaw}`;

export function PvsLab() {
  const eye = useNumberParams(EYE_PARAMS, START);
  const [door, setDoor] = useSearchParam<string>('door', { default: 'closed', parse: pickDoor });
  return (
    <LabScreen
      title="Visibility lab"
      path={PVS_PATH}
      stageName="What demo1 draws from here"
      params={EYE_PARAMS}
      state={eye}
      defaults={START}
      defaultWords="The lab starts at"
      unchanged="The eye at demo1's player start"
      noun="setting"
      extraChanged={door === 'closed' ? [] : ['the door']}
      extraControls={
        <>
          <ChoiceGroup
            legend="The door to the second area"
            name="door"
            value={door}
            onChange={setDoor}
            choices={[
              { value: 'closed', label: 'Closed', detail: 'As the level starts: its area portal is shut, so nothing behind it is drawn.' },
              { value: 'open', label: 'Open', detail: 'The game opens the portal while the door is open.' },
            ]}
          />
          <ButtonLink to={href(BY_THE_DOOR)} size="sm" variant="outline">
            Stand by the door
          </ButtonLink>
        </>
      }
    >
      {({ map, world }) => (
        <VisibilityView
          map={map}
          world={world}
          eye={{ x: eye.values.x, y: eye.values.y, z: eye.values.z }}
          yaw={eye.values.yaw}
          open={door === 'open'}
          moveTo={(next) => eye.setMany(next)}
        />
      )}
    </LabScreen>
  );
}

function VisibilityView({
  map,
  world,
  eye,
  yaw,
  open,
  moveTo,
}: {
  map: BspMap;
  world: LabWorld;
  eye: { x: number; y: number; z: number };
  yaw: number;
  open: boolean;
  moveTo: (eye: { x: number; y: number; z: number }) => void;
}) {
  // The way the 3D view faces: the Facing slider sets where it starts, and looking round in the
  // view turns it, so the plan's line follows the view rather than the slider.
  const [facing, setFacing] = React.useState(yaw);
  React.useEffect(() => setFacing(yaw), [yaw]);
  const floors = React.useMemo(() => mapFloors(map), [map]);
  const portals = React.useMemo(() => mapPortals(map), [map]);
  const openSet = React.useMemo(() => new Set(open ? portals.map((p) => p.number) : []), [open, portals]);
  // Keyed on the numbers, since the eye object is new on every render.
  const view = React.useMemo(() => viewFrom(map, floors, eye, openSet), [map, floors, eye.x, eye.y, eye.z, openSet]);
  const home = React.useMemo(() => ({ target: { x: eye.x, y: eye.y, z: eye.z }, yaw, pitch: 10, distance: 64 }), [eye.x, eye.y, eye.z, yaw]);
  const portalStates = React.useMemo(() => portals.map((p) => [p.number, open] as const), [portals, open]);
  const leaf = view.leaf >= 0 ? map.leafs[view.leaf]! : null;
  const draw = React.useCallback(
    (lines: Lines) => {
      if (leaf && view.cluster >= 0) lines.box(vec(leaf.mins), vec(leaf.maxs), AMBER);
    },
    [leaf, view.cluster],
  );

  return (
    <div className="grid gap-4 p-4">
      <PvsPlan floors={floors} view={view} yaw={facing} onPick={moveTo} />

      <MetricStrip label="What the renderer draws from here">
        <Metric label="Cluster" value={view.cluster < 0 ? format.missing : format.integer.format(view.cluster)} note={clusterNote(view)} />
        <Metric
          label="Clusters in its PVS"
          value={format.integer.format(view.clustersSeen)}
          note={`Of ${format.integer.format(view.clusters)}: ${format.share(view.clustersSeen / Math.max(1, view.clusters))} of the level.`}
        />
        <Metric
          label="Faces drawn"
          value={format.integer.format(view.facesDrawn)}
          note={`Of ${format.integer.format(view.worldFaces)} in the world, before the view's frustum cuts more.`}
        />
        <Metric label="Behind the door" value={format.integer.format(view.facesBehindDoors)} note={doorNote(view, open)} />
      </MetricStrip>

      <LabScene
        label="The renderer at the eye"
        shows={`demo1 drawn by the engine's renderer from the eye, which culls by the same PVS${open ? '' : ' and keeps the door shut'}.`}
        legend="Amber: the leaf the eye is in. Drag to look round: where the level stops is where the eye's PVS ends. The door itself is not drawn, so a shut door shows as a gap."
        map={map}
        model={world.model}
        home={home}
        draw={draw}
        standAt
        portals={portalStates}
        onTurn={(o) => setFacing(o.yaw)}
      />

      <section aria-labelledby="pvs-facts" className="grid gap-2">
        <h2 id="pvs-facts" className="type-label">
          Where the eye is
        </h2>
        <PropertyList items={facts(view, leaf?.contents ?? null)} />
      </section>

      <SourcePair
        heading="Finding the eye's leaf: Mod_PointInLeaf"
        note="The eye goes down the BSP tree, one plane at a time, until it reaches a leaf; the leaf holds its cluster and its area. id's renderer sends a point exactly on a plane to the back. The port sends it to the front, as the collision code's CM_PointLeafnum_r does; the fuzzing work against id's C changes the port to match the renderer."
      >
        <SourceCode title="id's C" file={ORIGINAL('ref_gl/gl_model.c')} excerpt={C_POINT} />
        <SourceCode title="The port (engine)" file={PORT('packages/engine/src/render/bspTraversal.ts')} excerpt={TS_POINT} />
      </SourcePair>
      <SourcePair
        heading="Unpacking a cluster's row: Mod_DecompressVis"
        note="Each row is one bit per cluster, and most bits are 0, so vis stores a run of zero bytes as a 0 and a count. demo1's rows average 143 bits set of 1,391. The port unpacks every row once, as the map loads; id's unpacks the eye's row each time the eye changes cluster."
      >
        <SourceCode title="id's C" file={ORIGINAL('ref_gl/gl_model.c')} excerpt={C_DECOMPRESS} />
        <SourceCode title="The port (formats)" file={PORT('packages/formats/src/bsp.ts')} excerpt={TS_DECOMPRESS} />
      </SourcePair>
      <SourcePair
        heading="Marking what to draw: R_SetupFrame and R_MarkLeaves"
        note="id's renderer marks every leaf whose cluster bit is set, and the nodes above it, then walks only the marked part of the tree. An eye in no cluster (inside a wall or outside the level) marks everything. id's also reads a second cluster 16 units below the eye (above it in water), so an eye at a water surface draws both sides; the port reads only the eye's own cluster."
      >
        <SourceCode title="id's C: the eye's clusters" file={ORIGINAL('ref_gl/gl_rmain.c')} excerpt={C_SETUP} />
        <SourceCode title="id's C: marking" file={ORIGINAL('ref_gl/gl_rsurf.c')} excerpt={C_MARK} />
        <SourceCode title="The port: one bit" file={PORT('packages/engine/src/render/bspTraversal.ts')} excerpt={TS_VISIBLE} />
        <SourceCode title="The port: the walk" file={PORT('packages/engine/src/render/bspTraversal.ts')} excerpt={TS_TRAVERSE} />
      </SourcePair>
      <SourcePair
        heading="Doors: FloodArea_r and CM_WriteAreaBits"
        note="The PVS cannot know a door is shut, so qbsp also splits the level into areas at each func_areaportal. The server floods from area to area through open portals and sends the client the areas joined to the eye's; the renderer skips a leaf in any other. The port floods the same way in the renderer. id's gives an eye in area 0 (outside the level) every area; the port gives it only area 0."
      >
        <SourceCode title="id's C: the flood" file={ORIGINAL('qcommon/cmodel.c')} excerpt={C_FLOOD} />
        <SourceCode title="id's C: the areas sent" file={ORIGINAL('qcommon/cmodel.c')} excerpt={C_AREABITS} />
        <SourceCode title="id's C: the renderer's check" file={ORIGINAL('ref_gl/gl_rsurf.c')} excerpt={C_AREACHECK} />
        <SourceCode title="The port (engine)" file={PORT('packages/engine/src/render/bspTraversal.ts')} excerpt={TS_AREAS} />
      </SourcePair>

      <FurtherReading
        items={[
          { title: "Graphics Programming Black Book, Quake's visible-surface determination", href: 'https://github.com/jagregory/abrash-black-book/blob/master/src/chapter-70.md', by: 'Michael Abrash', adds: 'why Quake chose a precomputed PVS over the beam tree, by the person who wrote it.' },
          { title: 'Portals: how Quake’s visibility is computed', href: 'https://habr.com/en/articles/876058', by: 'Pekka Väänänen, 2025', adds: 'the vis tool rebuilt in Python (vis.py), with diagrams of the portal flood that fills each row.' },
          { title: 'Quake 2 Source Code Review: OpenGL renderer', href: 'https://fabiensanglard.net/quake2/quake2_opengl_renderer.php', by: 'Fabien Sanglard', adds: "the frame this lab cuts into, from R_SetupFrame to the surfaces drawn." },
          { title: 'Quake 2 BSP File Format', href: 'https://www.flipcode.com/archives/Quake_2_BSP_File_Format.shtml', by: 'Max McGuire, flipcode', adds: 'every lump, the tree walk and the PVS compression.' },
          { title: 'Quake 2 PVS, realigned lightmaps and colour lightmaps', href: 'https://gamedev.net/blogs/entry/1523455-quake-2-pvs-realigned-lightmaps-and-colour-lightmaps', by: 'benryves, 2007', adds: "a loader author finding that Quake II's PVS is per cluster, not per leaf." },
        ]}
      />
    </div>
  );
}

const vec = (v: readonly number[]) => ({ x: v[0]!, y: v[1]!, z: v[2]! });

function clusterNote(v: PvsView): string {
  if (v.cluster < 0) return 'The eye is inside a wall or outside the level, where the renderer draws everything.';
  return `Leaf ${format.integer.format(v.leaf)}, area ${format.integer.format(v.area)}.`;
}

function doorNote(v: PvsView, open: boolean): string {
  if (open) return 'The door is open, so its area portal culls nothing.';
  if (v.facesBehindDoors === 0) return 'The PVS already leaves out everything past the door from here.';
  return 'In the PVS, but in an area the shut door cuts off, so not drawn.';
}

function facts(v: PvsView, contents: number | null): Property[] {
  const round = (n: number) => format.integer.format(Math.round(n));
  return [
    { term: 'Eye', value: `${round(v.eye.x)}  ${round(v.eye.y)}  ${round(v.eye.z)}` },
    { term: 'Leaf', value: v.leaf < 0 ? null : format.integer.format(v.leaf) },
    { term: 'Leaf contents', value: contents === null ? null : contents === 0 ? 'Empty' : contents & 1 ? 'Solid' : `Flags ${contents}` },
    { term: 'Area', value: v.area < 0 ? null : format.integer.format(v.area) },
    { term: 'Areas joined to it', value: v.areas ? [...v.areas].sort((a, b) => a - b).join(', ') : 'All' },
  ];
}
