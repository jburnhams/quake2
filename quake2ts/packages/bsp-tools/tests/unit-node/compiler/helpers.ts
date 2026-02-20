import { generateBrushWindings } from '../../../src/compiler/brushProcessing.js';
import { calculateBounds } from '../../../src/compiler/csg.js';
import type { BrushDef } from '../../../src/builder/types.js';
import type { CompileBrush, CompileSide, MapBrush } from '../../../src/types/compile.js';
import type { PlaneSet } from '../../../src/compiler/planes.js';

export function createCompileBrush(def: BrushDef, planeSet: PlaneSet, contents: number = 1): CompileBrush {
  const windings = generateBrushWindings(def);
  const sides: CompileSide[] = [];

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
