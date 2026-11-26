import type { ParsedMap } from './mapParser.js';
import type { MapEntityDef } from './entityParser.js';
import type { MapBrushDef, MapBrushSideDef } from './brushParser.js';
import type { BspBuilder } from '../builder/BspBuilder.js';
import type { BrushDef, BrushSideDef, EntityDef, TextureDef, PlaneDef } from '../builder/types.js';
import { planeFromPoints } from './brushParser.js';

/**
 * Converts a parsed map into BspBuilder calls/structures.
 * This bridges the text-based map parser with the geometry builder.
 *
 * @param map The parsed map data
 * @param builder The BspBuilder instance to populate
 */
export function mapToBuilder(map: ParsedMap, builder: BspBuilder): void {
  // 1. Handle worldspawn (Entity 0)
  const worldspawn = map.worldspawn;
  if (worldspawn) {
    const props: Record<string, string> = {};
    for (const [k, v] of worldspawn.properties) {
      props[k] = v;
    }
    builder.setWorldspawn(props);

    // Add worldspawn brushes
    for (const brush of worldspawn.brushes) {
      const brushDef = convertBrush(brush);
      if (brushDef) {
        builder.addBrush(brushDef);
      }
    }
  }

  // 2. Handle other entities
  for (let i = 0; i < map.entities.length; i++) {
    const ent = map.entities[i];
    // Skip worldspawn as it's already handled
    if (ent === worldspawn) continue;

    const entityDef = convertEntity(ent);
    builder.addEntity(entityDef);
  }
}

function convertEntity(mapEnt: MapEntityDef): EntityDef {
  const properties: Record<string, string> = {};
  for (const [k, v] of mapEnt.properties) {
    properties[k] = v;
  }

  const def: EntityDef = {
    classname: mapEnt.classname,
    properties,
  };

  if (mapEnt.brushes.length > 0) {
    def.brushes = [];
    for (const brush of mapEnt.brushes) {
      const brushDef = convertBrush(brush);
      if (brushDef) {
        def.brushes.push(brushDef);
      }
    }
  }

  return def;
}

function convertBrush(mapBrush: MapBrushDef): BrushDef | null {
  const sides: BrushSideDef[] = [];
  let contents: number | undefined;

  for (const mapSide of mapBrush.sides) {
    const plane = planeFromPoints(
      mapSide.planePoints[0],
      mapSide.planePoints[1],
      mapSide.planePoints[2]
    );

    if (!plane) {
      // Degenerate plane, skip this side or fail the brush?
      // A brush with a degenerate face is invalid.
      // For now, we return null to skip the entire brush.
      // In strict mode, this should probably throw.
      console.warn(`Skipping brush at line ${mapBrush.line}: Degenerate face detected.`);
      return null;
    }

    const texture: TextureDef = {
      name: mapSide.texture,
      offsetX: mapSide.offsetX,
      offsetY: mapSide.offsetY,
      rotation: mapSide.rotation,
      scaleX: mapSide.scaleX,
      scaleY: mapSide.scaleY
    };

    sides.push({
      plane,
      texture
    });

    // Capture contents from first side that has it (or last? usually consistent)
    if (mapSide.contents !== undefined) {
      contents = mapSide.contents;
    }
  }

  return {
    sides,
    contents
  };
}
