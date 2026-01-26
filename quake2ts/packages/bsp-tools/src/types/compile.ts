import type { Vec3, Bounds3 } from '@quake2ts/shared';

// TODO: Implement Winding type properly in section 25-2
export type Winding = any;

/** Internal plane during compilation (extends runtime plane) */
export interface CompilePlane {
  normal: Vec3;
  dist: number;
  type: number;
  signbits: number;
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
export interface BspBrush {
  original: MapBrush;
  sides: CompileSide[];
  bounds: Bounds3;
  next?: BspBrush;  // Linked list for fragments
}
