import type { Vec3, Bounds3, Winding } from '@quake2ts/shared';

export type { Winding };

/** Internal plane during compilation (extends runtime plane) */
export interface CompilePlane {
  normal: Vec3;
  dist: number;
  type: number;
  signbits?: number;
  hashChain?: number;  // For plane deduplication
}

/** Brush side during compilation */
export interface CompileSide {
  planeNum: number;
  texInfo: number;
  winding?: Winding;
  visible: boolean;
  tested: boolean;
  bevel: boolean;
}

/** Map brush before CSG */
export interface MapBrush {
  entityNum: number;
  brushNum: number;
  sides: CompileSide[];
  bounds: Bounds3;
  contents: number;
}

/** BSP brush after CSG (may be fragmented) */
export interface CompileBrush {
  original: MapBrush;
  sides: CompileSide[];
  bounds: Bounds3;
  next: CompileBrush | null;  // Linked list for fragments
}

/** Face structure for merging and tree construction */
export interface CompileFace {
  planeNum: number;
  side: number; // 0 = front, 1 = back
  texInfo: number;
  winding: Winding;
  contents: number;
  original?: CompileSide; // Reference to original brush side or previous face
  next: CompileFace | null;
  merged?: boolean;
  lightmapOffset?: number;
  lightmapSize?: [number, number];
}
