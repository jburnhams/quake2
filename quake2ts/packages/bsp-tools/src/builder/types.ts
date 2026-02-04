import type { Vec3 } from '@quake2ts/shared';

/** A brush defined by its bounding planes */
export interface BrushDef {
  sides: BrushSideDef[];
  contents?: number;  // CONTENTS_SOLID by default
}

/** A single side/face of a brush */
export interface BrushSideDef {
  plane: PlaneDef;
  texture: TextureDef;
}

/** Plane defined by normal and distance */
export interface PlaneDef {
  normal: Vec3;
  dist: number;
}

/** Texture application on a brush side */
export interface TextureDef {
  name: string;
  offsetX?: number;
  offsetY?: number;
  rotation?: number;
  scaleX?: number;
  scaleY?: number;
}

/** Entity definition */
export interface EntityDef {
  classname: string;
  properties: Record<string, string>;
  brushes?: BrushDef[];  // For brush entities (func_*)
}
