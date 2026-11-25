// The middle pane: the chosen file drawn as what it is. One read per file, keyed by the library's
// version so that opening a PAK which overrides the file reads it again, and decoded by decode.ts.
// Maps get their facts and entity table rather than a 3D view until the renderer library exists.
import * as React from 'react';
import {
  DataTable,
  DataView,
  EmptyState,
  MediaPlayer,
  Metric,
  MetricStrip,
  Skeleton,
  TextLink,
  format,
  useLoad,
  type Column,
  type Load,
} from 'strata-react';
import { parsePcx, type BspEntity } from '@quake2ts/formats';
import { useLibrary } from '../library/context';
import { PALETTE_PATH, decode, hexRows, type Decoded } from './decode';
import { Picture } from './Picture';

/** The decoded file, read through the library. Shared by the preview and the details pane. */
export function useDecodedFile(path: string): Load<Decoded> {
  const { library, version } = useLibrary();
  return useLoad({
    queryKey: ['file', version, path],
    staleTime: Infinity,
    retry: false,
    queryFn: async () => {
      const palette = async () => {
        if (!library.vfs.hasFile(PALETTE_PATH)) return null;
        return parsePcx(await library.read(PALETTE_PATH)).palette;
      };
      return decode(path, await library.read(path), palette);
    },
    describeError: (e) => `${path} could not be read: ${e instanceof Error ? e.message : String(e)}.`,
  });
}

/** A link that opens another file in the explorer, keeping the open folders. */
export function FileLink({ path, children }: { path: string; children?: React.ReactNode }) {
  const { library } = useLibrary();
  if (!library.vfs.hasFile(path)) return <span className="text-muted-foreground">{children ?? path}</span>;
  return <TextLink to={`?file=${encodeURIComponent(path)}`}>{children ?? path}</TextLink>;
}

export function Preview({ path }: { path: string }) {
  const load = useDecodedFile(path);
  return (
    <DataView
      state={load}
      skeleton={<PreviewSkeleton />}
      isEmpty={isEmptyFile}
      empty={<EmptyState title="This file is empty">It is in the PAK's directory but holds no bytes.</EmptyState>}
    >
      {(decoded) => <DecodedView path={path} decoded={decoded} />}
    </DataView>
  );
}

/** A file with no bytes (some PAKs carry placeholders); nothing to draw. */
export function isEmptyFile(decoded: Decoded): boolean {
  return (decoded.kind === 'binary' && decoded.bytes.length === 0) || (decoded.kind === 'text' && decoded.text.length === 0);
}

function PreviewSkeleton() {
  return (
    <div className="grid gap-3 p-4" aria-hidden>
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

function DecodedView({ path, decoded }: { path: string; decoded: Decoded }) {
  switch (decoded.kind) {
    case 'image':
      return (
        <div className="grid justify-items-start gap-3 p-4">
          <Picture picture={decoded.picture} label={`${path}, ${decoded.picture.width} by ${decoded.picture.height} pixels`} />
        </div>
      );
    case 'map':
      return <MapView decoded={decoded} />;
    case 'md2':
      return (
        <div className="grid gap-4 p-4">
          <MetricStrip label="Model size">
            <Metric label="Frames" value={format.integer.format(decoded.model.header.numFrames)} />
            <Metric label="Vertices" value={format.integer.format(decoded.model.header.numVertices)} />
            <Metric label="Triangles" value={format.integer.format(decoded.model.header.numTriangles)} />
          </MetricStrip>
          <DataTable
            caption="Animations"
            rows={decoded.animations}
            rowKey={(a) => a.name}
            columns={[
              { key: 'name', header: 'Animation', cell: (a) => a.name, value: (a) => a.name },
              { key: 'first', header: 'First frame', numeric: true, value: (a) => a.firstFrame },
              { key: 'frames', header: 'Frames', numeric: true, value: (a) => a.lastFrame - a.firstFrame + 1 },
            ]}
          />
          <section aria-label="Skins" className="grid gap-1">
            <h3 className="type-label">Skins</h3>
            {decoded.model.skins.length === 0 ? (
              <p className="type-body-sm text-muted-foreground">This model names no skins.</p>
            ) : (
              <ul className="grid gap-1 type-body-sm">
                {decoded.model.skins.map((s) => (
                  <li key={s.name}>
                    <FileLink path={s.name} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      );
    case 'md3':
      return (
        <div className="grid gap-4 p-4">
          <MetricStrip label="Model size">
            <Metric label="Frames" value={format.integer.format(decoded.model.header.numFrames)} />
            <Metric label="Surfaces" value={format.integer.format(decoded.model.header.numSurfaces)} />
            <Metric label="Tags" value={format.integer.format(decoded.model.header.numTags)} />
          </MetricStrip>
          <DataTable
            caption="Surfaces"
            rows={[...decoded.model.surfaces]}
            rowKey={(s) => s.name}
            columns={[
              { key: 'name', header: 'Surface', cell: (s) => s.name, value: (s) => s.name },
              { key: 'triangles', header: 'Triangles', numeric: true, value: (s) => s.triangles.length },
              { key: 'shaders', header: 'Shaders', cell: (s) => s.shaders.map((x) => x.name).join(', '), value: (s) => s.shaders.length },
            ]}
          />
        </div>
      );
    case 'sprite':
      return (
        <div className="grid gap-4 p-4">
          <DataTable
            caption="Frames"
            rows={decoded.sprite.frames.map((f, index) => ({ ...f, index }))}
            rowKey={(f) => String(f.index)}
            columns={[
              { key: 'index', header: 'Frame', numeric: true, value: (f) => f.index + 1 },
              { key: 'picture', header: 'Picture', cell: (f) => <FileLink path={f.name} />, value: (f) => f.name },
              { key: 'size', header: 'Size', numeric: true, cell: (f) => `${f.width} × ${f.height}`, value: (f) => f.width * f.height },
            ]}
          />
        </div>
      );
    case 'audio':
      return <SoundView path={path} bytes={decoded.bytes} />;
    case 'text':
      return <pre className="m-0 overflow-auto p-4 font-mono type-body-sm whitespace-pre-wrap">{decoded.text}</pre>;
    default:
      return <HexView bytes={decoded.bytes} />;
  }
}

function SoundView({ path, bytes }: { path: string; bytes: Uint8Array }) {
  const [url, setUrl] = React.useState<string | null>(null);
  React.useEffect(() => {
    const next = URL.createObjectURL(new Blob([bytes.slice()], { type: 'audio/wav' }));
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [bytes]);
  return <div className="p-4">{url && <MediaPlayer label={path} kind="audio" src={url} />}</div>;
}

function HexView({ bytes }: { bytes: Uint8Array }) {
  const rows = hexRows(bytes);
  return (
    <div className="grid gap-2 p-4">
      <p className="type-body-sm text-muted-foreground">
        The explorer has no viewer for this kind of file yet. Its first {format.bytes(Math.min(bytes.length, 512))} are shown as bytes.
      </p>
      <pre aria-label="Bytes" className="m-0 overflow-auto font-mono type-body-sm">
        {rows.map((r) => `${r.offset}  ${r.hex.padEnd(47)}  ${r.text}`).join('\n')}
      </pre>
    </div>
  );
}

type EntityRow = { index: number; classname: string; targetname: string; origin: string; model: string };

const entityColumns: Column<EntityRow>[] = [
  { key: 'index', header: 'No.', numeric: true, value: (e) => e.index },
  { key: 'classname', header: 'Class', value: (e) => e.classname },
  { key: 'targetname', header: 'Target name', value: (e) => e.targetname || null },
  { key: 'origin', header: 'Origin', cell: (e) => <span className="font-mono">{e.origin}</span>, value: (e) => e.origin || null },
  { key: 'model', header: 'Brush model', value: (e) => e.model || null },
];

function entityRow(entity: BspEntity, index: number): EntityRow {
  const p = entity.properties;
  return { index, classname: entity.classname ?? '', targetname: p.targetname ?? '', origin: p.origin ?? '', model: p.model ?? '' };
}

function MapView({ decoded }: { decoded: Extract<Decoded, { kind: 'map' }> }) {
  const { map, textures } = decoded;
  const rows = React.useMemo(() => map.entities.entities.map(entityRow), [map]);
  const title = map.entities.worldspawn?.properties.message;
  return (
    <div className="grid gap-4 p-4">
      {title ? <p className="type-heading">{title}</p> : null}
      <MetricStrip label="Map size">
        <Metric label="Entities" value={format.integer.format(map.entities.entities.length)} />
        <Metric label="Faces" value={format.integer.format(map.faces.length)} />
        <Metric label="Brush models" value={format.integer.format(map.models.length)} />
        <Metric label="Textures" value={format.integer.format(textures.length)} />
      </MetricStrip>
      <DataTable caption="Entities" columns={entityColumns} rows={rows} rowKey={(e) => String(e.index)} sortParam="sort" maxHeight={480} />
      <section aria-label="Textures" className="grid gap-1">
        <h3 className="type-label">Textures</h3>
        <ul className="grid gap-1 type-body-sm sm:grid-cols-3">
          {textures.map((t) => (
            <li key={t}>
              <FileLink path={`textures/${t}.wal`}>{t}</FileLink>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

/** Shown in the middle pane before a file is chosen. */
export function NoFileChosen() {
  return (
    <div className="grid h-full place-items-center p-4">
      <EmptyState title="Choose a file in the tree">
        Pictures and textures are drawn, sounds play, and maps list their entities and textures.
      </EmptyState>
    </div>
  );
}
