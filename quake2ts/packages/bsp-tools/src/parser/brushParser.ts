import type { Vec3 } from '@quake2ts/shared';
import { MapTokenizer } from './tokenizer.js';

export interface MapBrushSideDef {
  /** Three points defining the plane (counter-clockwise when viewed from front) */
  planePoints: [Vec3, Vec3, Vec3];

  /** Texture name */
  texture: string;

  /** Texture coordinates (standard format) */
  offsetX: number;
  offsetY: number;
  rotation: number;
  scaleX: number;
  scaleY: number;

  /** Valve 220 UV axes (if mapversion >= 220) */
  uAxis?: Vec3;
  uOffset?: number;
  vAxis?: Vec3;
  vOffset?: number;

  /** Surface properties (optional) */
  contents?: number;
  surfaceFlags?: number;
  value?: number;

  line: number;
}

export interface MapBrushDef {
  sides: MapBrushSideDef[];
  line: number;
}

/**
 * Parses a brush definition from the map file.
 * NOTE: This is currently a stub and will be fully implemented in a later task.
 */
export function parseBrush(
  tokenizer: MapTokenizer,
  mapVersion: number
): MapBrushDef {
  throw new Error('parseBrush not implemented yet');
}
