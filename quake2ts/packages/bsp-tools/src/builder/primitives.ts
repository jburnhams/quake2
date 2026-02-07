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

export interface WedgeParams {
  origin: Vec3;
  size: Vec3;

  /** Direction the ramp faces (ascends towards) */
  direction: 'north' | 'south' | 'east' | 'west';

  texture?: string | TextureDef;
}

export interface StairsParams {
  origin: Vec3;
  width: number;
  height: number;
  depth: number;
  stepCount: number;
  direction: 'north' | 'south' | 'east' | 'west';
  texture?: string | TextureDef;
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

  const sidesProvided = !!params.sides;
  const include = params.sides ?? {
    top: true,
    bottom: true,
    north: true,
    south: true,
    east: true,
    west: true,
  };

  const shouldInclude = (face: keyof NonNullable<HollowBoxParams['sides']>) => {
    if (!sidesProvided) return true;
    return !!include[face];
  };

  // Helper to create a wall from mins/maxs
  const createWall = (mins: Vec3, maxs: Vec3, face: keyof NonNullable<HollowBoxParams['sides']>) => {
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

    let wallTexture = params.texture;

    // Only perform remapping if we have a per-face texture object
    if (params.texture && typeof params.texture !== 'string' && !('name' in params.texture)) {
      const perFace = params.texture as any;
      if (perFace[face]) {
        // Find the inner face for this wall
        let innerFace: 'top' | 'bottom' | 'north' | 'south' | 'east' | 'west' | undefined;
        if (face === 'top') innerFace = 'bottom';
        else if (face === 'bottom') innerFace = 'top';
        else if (face === 'north') innerFace = 'south';
        else if (face === 'south') innerFace = 'north';
        else if (face === 'east') innerFace = 'west';
        else if (face === 'west') innerFace = 'east';

        if (innerFace) {
          // Construct a new texture object where the inner face gets the requested texture
          wallTexture = { [innerFace]: perFace[face] };
        }
      }
    }

    brushes.push(box({
      origin,
      size,
      texture: wallTexture,
      contents: params.contents
    }));
  };

  // Top (Z+)
  if (shouldInclude('top')) {
    // Spans full X/Y, thickness in Z downwards from maxs.z
    createWall(
      { x: originalMins.x, y: originalMins.y, z: originalMaxs.z - t },
      originalMaxs,
      'top'
    );
  }

  // Bottom (Z-)
  if (shouldInclude('bottom')) {
    // Spans full X/Y, thickness in Z upwards from mins.z
    createWall(
      originalMins,
      { x: originalMaxs.x, y: originalMaxs.y, z: originalMins.z + t },
      'bottom'
    );
  }

  // North (Y+)
  if (shouldInclude('north')) {
    // Spans full X/Z (minus floor/ceiling overlap if we wanted non-overlapping, but simple overlap is easier)
    // Here we do full overlap.
    createWall(
      { x: originalMins.x, y: originalMaxs.y - t, z: originalMins.z },
      originalMaxs,
      'north'
    );
  }

  // South (Y-)
  if (shouldInclude('south')) {
    createWall(
      originalMins,
      { x: originalMaxs.x, y: originalMins.y + t, z: originalMaxs.z },
      'south'
    );
  }

  // East (X+)
  if (shouldInclude('east')) {
    createWall(
      { x: originalMaxs.x - t, y: originalMins.y, z: originalMins.z },
      originalMaxs,
      'east'
    );
  }

  // West (X-)
  if (shouldInclude('west')) {
    createWall(
      originalMins,
      { x: originalMins.x + t, y: originalMaxs.y, z: originalMaxs.z },
      'west'
    );
  }

  return brushes;
}

/**
 * Create a wedge/ramp brush
 */
export function wedge(params: WedgeParams): BrushDef {
  // Start with a standard box
  const b = box({
    origin: params.origin,
    size: params.size,
    texture: params.texture
  });

  // Calculate bounds
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

  // Identify and remove the top face (normal 0,0,1)
  const topIndex = b.sides.findIndex(s =>
    Math.abs(s.plane.normal.x) < 0.001 &&
    Math.abs(s.plane.normal.y) < 0.001 &&
    s.plane.normal.z > 0.999
  );

  if (topIndex !== -1) {
    b.sides.splice(topIndex, 1);
  }

  // Calculate slope normal based on direction
  // The ramp ascends in the given direction.
  let normal: Vec3;
  let distPoint: Vec3;

  if (params.direction === 'north') {
    // Low South, High North
    // Normal: (0, -size.z, size.y) normalized
    normal = { x: 0, y: -params.size.z, z: params.size.y };
    distPoint = { x: params.origin.x, y: mins.y, z: mins.z };
  } else if (params.direction === 'south') {
    // Low North, High South
    // Normal: (0, size.z, size.y) normalized
    normal = { x: 0, y: params.size.z, z: params.size.y };
    distPoint = { x: params.origin.x, y: maxs.y, z: mins.z };
  } else if (params.direction === 'east') {
    // Low West, High East
    // Normal: (-size.z, 0, size.x) normalized
    normal = { x: -params.size.z, y: 0, z: params.size.x };
    distPoint = { x: mins.x, y: params.origin.y, z: mins.z };
  } else { // west
    // Low East, High West
    // Normal: (size.z, 0, size.x) normalized
    normal = { x: params.size.z, y: 0, z: params.size.x };
    distPoint = { x: maxs.x, y: params.origin.y, z: mins.z };
  }

  // Normalize
  const len = Math.sqrt(normal.x * normal.x + normal.y * normal.y + normal.z * normal.z);
  normal = {
  normal = normalizeVec3(normal);

  const dist = dotVec3(normal, distPoint);

  // Add slope face
  b.sides.push({
    plane: createPlane(normal, dist),
    texture: resolveTexture(params.texture, 'top') // Use top texture for slope
  });

  return b;
}

/**
 * Create stair steps
 */
export function stairs(params: StairsParams): BrushDef[] {
  const brushes: BrushDef[] = [];
  const count = Math.max(1, Math.floor(params.stepCount));

  const stepHeight = params.height / count;
  const stepDepth = params.depth / count;

  // Origin is center of the whole bounding box
  const totalHalfSize = {
    x: params.width * 0.5,
    y: params.depth * 0.5,
    z: params.height * 0.5
  };

  const mins = {
    x: params.origin.x - totalHalfSize.x,
    y: params.origin.y - totalHalfSize.y,
    z: params.origin.z - totalHalfSize.z,
  };

  // Direction determines how steps are arranged
  // 'north': ascend towards North (Y+)
  // Steps progress in Y from South to North, and Z from Bottom to Top.

  for (let i = 0; i < count; i++) {
    // Calculate bounds for this step
    // Height: from bottom (mins.z) to (i+1)*stepHeight
    const h = (i + 1) * stepHeight;
    const currentZMin = mins.z; // All steps start from floor (solid style)
    const currentZMax = mins.z + h;
    const currentZSize = currentZMax - currentZMin;
    const currentZCenter = currentZMin + currentZSize * 0.5;

    // Determine position based on direction.
    // Assumptions:
    // - width: dimension perpendicular to ascent direction
    // - depth: dimension parallel to ascent direction (total run)
    // - height: total rise

    let boxSize: Vec3;
    let boxOrigin: Vec3;

    if (params.direction === 'north') {
      // Ascend Y+
      // Step i starts at y = mins.y + i*stepDepth
      const yStart = mins.y + i * stepDepth;

      boxSize = { x: params.width, y: stepDepth, z: currentZSize };
      boxOrigin = {
        x: params.origin.x,
        y: yStart + stepDepth * 0.5,
        z: currentZCenter
      };
    } else if (params.direction === 'south') {
      // Ascend Y- (Low at North, High at South)
      // Steps progress from maxs.y towards mins.y.
      const maxY = mins.y + params.depth;
      const yStart = maxY - (i + 1) * stepDepth;

      boxSize = { x: params.width, y: stepDepth, z: currentZSize };
      boxOrigin = {
        x: params.origin.x,
        y: yStart + stepDepth * 0.5,
        z: currentZCenter
      };
    } else if (params.direction === 'east') {
      // Ascend X+
      // Low West (mins.x), High East.
      const xStart = mins.x + i * stepDepth;

      boxSize = { x: stepDepth, y: params.width, z: currentZSize };
      boxOrigin = {
        x: xStart + stepDepth * 0.5,
        y: params.origin.y,
        z: currentZCenter
      };
    } else { // west
      // Ascend X-
      // Low East (maxs.x), High West.
      const maxX = mins.x + params.depth;
      const xStart = maxX - (i + 1) * stepDepth;

      boxSize = { x: stepDepth, y: params.width, z: currentZSize };
      boxOrigin = {
        x: xStart + stepDepth * 0.5,
        y: params.origin.y,
        z: currentZCenter
      };
    }

    brushes.push(box({
      origin: boxOrigin,
      size: boxSize,
      texture: params.texture
    }));
  }

  return brushes;
}
