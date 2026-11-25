// The right pane: facts about the chosen file. Where it is (which PAK wins it, at what offset),
// then what decoding found. WAL surface flags are named, since a level designer reads them by name.
import * as React from 'react';
import { DataView, EmptyState, Inspector, InspectorSection, PropertyList, format, type Property } from 'strata-react';
import { useLibrary } from '../library/context';
import { KIND_NAMES, kindOf, type Decoded } from '../preview/decode';
import { isEmptyFile, useDecodedFile } from '../preview/Preview';

// From q_shared.h (SURF_*).
const SURFACE_FLAGS: [number, string][] = [
  [0x1, 'Light'],
  [0x2, 'Slick'],
  [0x4, 'Sky'],
  [0x8, 'Warp'],
  [0x10, 'Translucent 33%'],
  [0x20, 'Translucent 66%'],
  [0x40, 'Flowing'],
  [0x80, 'No draw'],
];

// From q_shared.h (CONTENTS_*), the bits a texture can carry onto its brush.
const CONTENTS: [number, string][] = [
  [0x1, 'Solid'],
  [0x2, 'Window'],
  [0x4, 'Aux'],
  [0x8, 'Lava'],
  [0x10, 'Slime'],
  [0x20, 'Water'],
  [0x40, 'Mist'],
  [0x8000, 'Area portal'],
  [0x10000, 'Player clip'],
  [0x20000, 'Monster clip'],
  [0x40000, 'Current 0°'],
  [0x80000, 'Current 90°'],
  [0x100000, 'Current 180°'],
  [0x200000, 'Current 270°'],
  [0x400000, 'Current up'],
  [0x800000, 'Current down'],
  [0x1000000, 'Origin'],
  [0x8000000, 'Detail'],
  [0x10000000, 'Translucent'],
  [0x20000000, 'Ladder'],
];

/** The names of the bits set in a value, or "None". */
export function flagNames(value: number, names: [number, string][]): string {
  const set = names.filter(([bit]) => (value & bit) !== 0).map(([, name]) => name);
  return set.length ? set.join(', ') : 'None';
}

function decodedFacts(decoded: Decoded): Property[] {
  switch (decoded.kind) {
    case 'image': {
      const facts: Property[] = [
        { term: 'Format', value: decoded.picture.format },
        { term: 'Size', value: `${decoded.picture.width} × ${decoded.picture.height}`, unit: 'pixels' },
      ];
      if (decoded.flags !== undefined) facts.push({ term: 'Surface', value: flagNames(decoded.flags, SURFACE_FLAGS) });
      if (decoded.contents !== undefined) facts.push({ term: 'Contents', value: flagNames(decoded.contents, CONTENTS) });
      return facts;
    }
    case 'map':
      return [
        { term: 'BSP version', value: decoded.map.header.version },
        { term: 'Leaves', value: format.integer.format(decoded.map.leafs.length) },
        { term: 'Lightmap data', value: format.bytes(decoded.map.lightMaps.byteLength) },
        { term: 'Visibility', value: decoded.map.visibility ? `${format.integer.format(decoded.map.visibility.numClusters)} clusters` : 'None' },
      ];
    case 'md2':
      return [
        { term: 'Skin size', value: `${decoded.model.header.skinWidth} × ${decoded.model.header.skinHeight}`, unit: 'pixels' },
        { term: 'Animations', value: decoded.animations.length },
      ];
    case 'md3':
      return [{ term: 'Name', value: decoded.model.header.name }];
    case 'sprite':
      return [{ term: 'Frames', value: decoded.sprite.numFrames }];
    case 'audio':
      return [
        { term: 'Sample rate', value: format.integer.format(decoded.wav.sampleRate), unit: 'Hz' },
        { term: 'Channels', value: decoded.wav.channels === 1 ? 'Mono' : decoded.wav.channels === 2 ? 'Stereo' : decoded.wav.channels },
        { term: 'Bits per sample', value: decoded.wav.bitsPerSample },
        { term: 'Length', value: format.decimal.format(decoded.wav.samples.length / decoded.wav.channels / decoded.wav.sampleRate), unit: 's' },
      ];
    case 'text':
      return [{ term: 'Lines', value: format.integer.format(decoded.text.split('\n').length) }];
    default:
      return [];
  }
}

export function FileDetails({ path }: { path: string | null }) {
  const { library, version } = useLibrary();
  const meta = React.useMemo(() => (path ? library.vfs.getFileMetadata(path) : undefined), [library, version, path]);
  return (
    <Inspector
      title={path ? path.slice(path.lastIndexOf('/') + 1) : null}
      kind={path ? KIND_NAMES[kindOf(path)] : undefined}
      selectionKey={path ?? undefined}
      storageKey="explorer-details"
      className="p-3"
      empty={<EmptyState title="No file chosen">Choose a file to see where it comes from and what is in it.</EmptyState>}
    >
      {path && meta ? (
        <>
          <InspectorSection id="where" title="Where it is">
            <PropertyList
              items={[
                { term: 'Path', value: meta.path },
                { term: 'Size', value: format.bytes(meta.size) },
                { term: 'From', value: meta.sourcePak },
                { term: 'Offset', value: format.integer.format(meta.offset) },
              ]}
            />
          </InspectorSection>
          <InspectorSection id="contents" title="What is in it">
            <DecodedFacts path={path} />
          </InspectorSection>
        </>
      ) : null}
    </Inspector>
  );
}

function DecodedFacts({ path }: { path: string }) {
  const load = useDecodedFile(path);
  return (
    <DataView
      state={load}
      skeleton={<p className="type-body-sm text-muted-foreground">Reading…</p>}
      isEmpty={isEmptyFile}
      empty={<p className="type-body-sm text-muted-foreground">The file is empty.</p>}
    >
      {(decoded) => {
        const items = decodedFacts(decoded);
        return items.length ? <PropertyList items={items} /> : <p className="type-body-sm text-muted-foreground">Nothing more is known about this file.</p>;
      }}
    </DataView>
  );
}
