import {
  generateBrushWindings,
  calculateBounds,
  type CompileBrush,
  type CompileSide,
  type MapBrush,
  type PlaneSet,
  type BrushDef
} from '@quake2ts/bsp-tools';
import { createEmptyBounds3, CONTENTS_SOLID } from '@quake2ts/shared';

/**
 * Creates a CompileBrush from a BrushDef for testing.
 *
 * @param def The BrushDef to convert (usually from primitives like box())
 * @param planeSet The PlaneSet to use for plane deduplication
 * @param contents Optional contents flags (default: 1)
 * @returns A CompileBrush suitable for CSG operations
 */
export function createCompileBrush(def: BrushDef, planeSet: PlaneSet, contents: number = 1): CompileBrush {
  const windings = generateBrushWindings(def);
  const sides: CompileSide[] = [];

  // Add planes to PlaneSet and create sides
  def.sides.forEach((s, i) => {
    const planeNum = planeSet.findOrAdd(s.plane.normal, s.plane.dist);
    sides.push({
      planeNum,
      texInfo: 0,
      winding: windings.get(i),
      visible: true,
      tested: false,
      bevel: false
    });
  });

  const bounds = calculateBounds(sides);

  const mapBrush: MapBrush = {
    entityNum: 0,
    brushNum: 0,
    sides,
    bounds,
    contents
  };

  return {
    original: mapBrush,
    sides,
    bounds,
    next: null
  };
}

/**
 * Creates a dummy MapBrush with specified sides and contents.
 * Useful for testing face extraction and other compiler stages where
 * full brush geometry is not needed.
 *
 * @param sides Array of CompileSide objects
 * @param contents Contents flags (default: CONTENTS_SOLID)
 * @returns A simplified MapBrush
 */
export function createDummyBrush(sides: any[], contents: number = CONTENTS_SOLID): MapBrush {
  return {
    entityNum: 0,
    brushNum: 0,
    sides: sides,
    bounds: createEmptyBounds3(),
    contents
  };
}

// Removing createMockLeaf and createMockPortal from test-utils because `@quake2ts/bsp-tools/src` paths aren't exported
// in a way that test-utils can resolve them during DTS generation. bsp-tools doesn't export compiler internals
// (TreeLeaf, Portal) via index.ts, leading to TS2307. We will keep these definitions local to tests that need them.
