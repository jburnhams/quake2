import { type Vec3, scaleVec3 } from '@quake2ts/shared';
import type { BrushDef, BrushSideDef, TextureDef, PlaneDef } from './types.js';
import { DEFAULT_TEXTURE, DEFAULT_CONTENTS } from './defaults.js';

export interface BoxParams {
  /** Center of the box */
  origin: Vec3;

  /** Size in each dimension [width, depth, height] */
  size: Vec3;

  /** Texture for all faces (or per-face) */
  texture?: string | TextureDef | {
    top?: TextureDef;
    bottom?: TextureDef;
    north?: TextureDef;
    south?: TextureDef;
    east?: TextureDef;
    west?: TextureDef;
  };

  /** Contents flags */
  contents?: number;
}

export interface HollowBoxParams extends BoxParams {
  /** Wall thickness */
  wallThickness: number;

  /** Which sides to include (default: all) */
  sides?: {
    top?: boolean;
    bottom?: boolean;
    north?: boolean;
    south?: boolean;
    east?: boolean;
    west?: boolean;
  };
}

// Internal helper to normalize texture input
function resolveTexture(
  textureInput: BoxParams['texture'],
  face: 'top' | 'bottom' | 'north' | 'south' | 'east' | 'west'
): TextureDef {
  if (!textureInput) {
    return DEFAULT_TEXTURE;
  }

  if (typeof textureInput === 'string') {
    return { ...DEFAULT_TEXTURE, name: textureInput };
  }

  if ('name' in textureInput) {
    return textureInput as TextureDef;
  }

  // Per-face object
  const faces = textureInput as any;
  if (faces[face]) {
    return faces[face] as TextureDef;
  }

  // Fallback if specific face not defined but object provided?
  // Maybe just return default.
  return DEFAULT_TEXTURE;
}

function createPlane(normal: Vec3, dist: number): PlaneDef {
  return { normal, dist };
}

/**
 * Create a solid box brush
 */
export function box(params: BoxParams): BrushDef {
  const halfSize = scaleVec3(params.size, 0.5);
  const mins = {
    x: params.origin.x - halfSize.x,
    y: params.origin.y - halfSize.y,
    z: params.origin.z - halfSize.z,
  };
  const maxs = {
    x: params.origin.x + halfSize.x,
    y: params.origin.y + halfSize.y,
    z: params.origin.z + halfSize.z,
  };

  const sides: BrushSideDef[] = [];

  // Top (Z+)
  // Plane: (0, 0, 1) dot p = maxs.z
  sides.push({
    plane: createPlane({ x: 0, y: 0, z: 1 }, maxs.z),
    texture: resolveTexture(params.texture, 'top'),
  });

  // Bottom (Z-)
  // Plane: (0, 0, -1) dot p = -mins.z
  sides.push({
    plane: createPlane({ x: 0, y: 0, z: -1 }, -mins.z),
    texture: resolveTexture(params.texture, 'bottom'),
  });

  // North (Y+)
  // Plane: (0, 1, 0) dot p = maxs.y
  sides.push({
    plane: createPlane({ x: 0, y: 1, z: 0 }, maxs.y),
    texture: resolveTexture(params.texture, 'north'),
  });

  // South (Y-)
  // Plane: (0, -1, 0) dot p = -mins.y
  sides.push({
    plane: createPlane({ x: 0, y: -1, z: 0 }, -mins.y),
    texture: resolveTexture(params.texture, 'south'),
  });

  // East (X+)
  // Plane: (1, 0, 0) dot p = maxs.x
  sides.push({
    plane: createPlane({ x: 1, y: 0, z: 0 }, maxs.x),
    texture: resolveTexture(params.texture, 'east'),
  });

  // West (X-)
  // Plane: (-1, 0, 0) dot p = -mins.x
  sides.push({
    plane: createPlane({ x: -1, y: 0, z: 0 }, -mins.x),
    texture: resolveTexture(params.texture, 'west'),
  });

  return {
    sides,
    contents: params.contents ?? DEFAULT_CONTENTS,
  };
}

/**
 * Create a hollow box (room) from 6 wall brushes
 */
export function hollowBox(params: HollowBoxParams): BrushDef[] {
  const halfSize = scaleVec3(params.size, 0.5);
  const originalMins = {
    x: params.origin.x - halfSize.x,
    y: params.origin.y - halfSize.y,
    z: params.origin.z - halfSize.z,
  };
  const originalMaxs = {
    x: params.origin.x + halfSize.x,
    y: params.origin.y + halfSize.y,
    z: params.origin.z + halfSize.z,
  };

  const t = params.wallThickness;
  const brushes: BrushDef[] = [];

  const include = params.sides ?? {
    top: true,
    bottom: true,
    north: true,
    south: true,
    east: true,
    west: true,
  };

  // Helper to create a wall from mins/maxs
  const createWall = (mins: Vec3, maxs: Vec3, face: keyof typeof include) => {
    // Calculate center and size for box()
    const size = {
      x: maxs.x - mins.x,
      y: maxs.y - mins.y,
      z: maxs.z - mins.z,
    };
    const origin = {
      x: mins.x + size.x * 0.5,
      y: mins.y + size.y * 0.5,
      z: mins.z + size.z * 0.5,
    };

    // For a wall, we might want to adjust textures or orientation, but passing params.texture is likely expected
    // Note: This applies the texture mapping to the wall brush.
    brushes.push(box({
      origin,
      size,
      texture: params.texture,
      contents: params.contents
    }));
  };

  // Top (Z+)
  if (include.top !== false) {
    // Spans full X/Y, thickness in Z downwards from maxs.z
    createWall(
      { x: originalMins.x, y: originalMins.y, z: originalMaxs.z - t },
      originalMaxs,
      'top'
    );
  }

  // Bottom (Z-)
  if (include.bottom !== false) {
    // Spans full X/Y, thickness in Z upwards from mins.z
    createWall(
      originalMins,
      { x: originalMaxs.x, y: originalMaxs.y, z: originalMins.z + t },
      'bottom'
    );
  }

  // North (Y+)
  if (include.north !== false) {
    // Spans full X/Z (minus floor/ceiling overlap if we wanted non-overlapping, but simple overlap is easier)
    // Here we do full overlap.
    createWall(
      { x: originalMins.x, y: originalMaxs.y - t, z: originalMins.z },
      originalMaxs,
      'north'
    );
  }

  // South (Y-)
  if (include.south !== false) {
    createWall(
      originalMins,
      { x: originalMaxs.x, y: originalMins.y + t, z: originalMaxs.z },
      'south'
    );
  }

  // East (X+)
  if (include.east !== false) {
    createWall(
      { x: originalMaxs.x - t, y: originalMins.y, z: originalMins.z },
      originalMaxs,
      'east'
    );
  }

  // West (X-)
  if (include.west !== false) {
    createWall(
      originalMins,
      { x: originalMins.x + t, y: originalMaxs.y, z: originalMaxs.z },
      'west'
    );
  }

  return brushes;
}
