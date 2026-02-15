import {
  generateBrushWindings,
  calculateBounds,
  type CompileBrush,
  type CompileSide,
  type MapBrush,
  type PlaneSet,
  type BrushDef
} from '@quake2ts/bsp-tools';

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
