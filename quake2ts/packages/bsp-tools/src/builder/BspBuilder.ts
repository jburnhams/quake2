import { type Vec3, scaleVec3, subtractVec3, addVec3, dotVec3 } from '@quake2ts/shared';
import type { ParsedMap } from '../parser/mapParser.js';
import type { BrushDef, EntityDef, OpeningDef } from './types.js';
import { box, stairs, type StairsParams } from './primitives.js';
import { subtractRects, type Rect } from './rectUtils.js';

// TODO: Proper BspData type definition
export type BspData = any;

export interface BuildOptions {
  /** Use extended QBSP format for larger maps */
  extendedFormat?: boolean;

  /** Skip VIS computation (all visible) */
  skipVis?: boolean;

  /** Skip lighting (fullbright) */
  skipLighting?: boolean;

  /** Verbose logging */
  verbose?: boolean;
}

export interface BuildStats {
  brushCount: number;
  planeCount: number;
  nodeCount: number;
  leafCount: number;
  faceCount: number;
  entityCount: number;
  buildTimeMs: number;
}

export interface BuildResult {
  bsp: BspData;
  stats: BuildStats;
  warnings: string[];
}

export interface RoomParams {
  origin: Vec3;
  size: Vec3;
  wallThickness?: number;
  floorTexture?: string;
  ceilingTexture?: string;
  wallTexture?: string;

  /** Openings (doors, windows) */
  openings?: OpeningDef[];
}

export interface CorridorParams {
  start: Vec3;
  end: Vec3;
  width: number;
  height: number;
  wallThickness?: number;
  texture?: string;
}

export interface BuildValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export class BspBuilder {
  private worldspawnProps: Map<string, string> = new Map();
  private entities: EntityDef[] = [];
  private brushes: BrushDef[] = []; // Brushes attached to worldspawn
  private options: BuildOptions;

  constructor(options: BuildOptions = {}) {
    this.options = options;
    // Ensure worldspawn exists conceptually, properties will be merged
    this.worldspawnProps.set('classname', 'worldspawn');
  }

  // Entity management
  setWorldspawn(properties: Record<string, string>): this {
    for (const [key, value] of Object.entries(properties)) {
      this.worldspawnProps.set(key, value);
    }
    return this;
  }

  addEntity(entity: EntityDef): this {
    this.entities.push(entity);
    return this;
  }

  // Brush primitives (added to worldspawn)
  addBrush(brush: BrushDef): this {
    this.brushes.push(brush);
    return this;
  }

  addBrushes(brushes: BrushDef[]): this {
    this.brushes.push(...brushes);
    return this;
  }

  // High-level primitives
  addRoom(params: RoomParams): this {
    const halfSize = scaleVec3(params.size, 0.5);
    const mins = subtractVec3(params.origin, halfSize);
    const maxs = addVec3(params.origin, halfSize);
    const t = params.wallThickness ?? 16; // Default thickness

    // Floor
    this.addBrush(box({
      origin: { x: params.origin.x, y: params.origin.y, z: mins.z + t * 0.5 },
      size: { x: params.size.x, y: params.size.y, z: t },
      texture: params.floorTexture
    }));

    // Ceiling
    this.addBrush(box({
      origin: { x: params.origin.x, y: params.origin.y, z: maxs.z - t * 0.5 },
      size: { x: params.size.x, y: params.size.y, z: t },
      texture: params.ceilingTexture
    }));

    // Walls
    const wallHeight = params.size.z - 2 * t;

    // Helper to process a wall
    const processWall = (
      wall: 'north' | 'south' | 'east' | 'west',
      wallOrigin: Vec3,
      wallSize: Vec3
    ) => {
      // Find openings for this wall
      const wallOpenings = params.openings?.filter(o => o.wall === wall) || [];

      if (wallOpenings.length === 0) {
        this.addBrush(box({
          origin: wallOrigin,
          size: wallSize,
          texture: params.wallTexture
        }));
        return;
      }

      // We have openings.
      // Define wall rect relative to bottom-left corner of the wall face

      let wallRect: Rect;
      let getHoleRect: (o: OpeningDef) => Rect;
      let convertRectToBox: (r: Rect) => { origin: Vec3, size: Vec3 };

      if (wall === 'north' || wall === 'south') {
        // Wall spans X and Z
        // Rect: x = relative X from wall center, y = relative Z from wall center
        wallRect = { x: 0, y: 0, w: wallSize.x, h: wallSize.z };

        getHoleRect = (o: OpeningDef) => {
          // o.position is relative to room center.
          // wall center is at room center (for X/Z).
          // localX/localZ are relative to bottom-left of wall.
          const localX = o.position.x + wallSize.x * 0.5;
          const localZ = o.position.z + wallSize.z * 0.5;
          return {
            x: localX - o.size.x * 0.5,
            y: localZ - o.size.z * 0.5,
            w: o.size.x,
            h: o.size.z
          };
        };

        convertRectToBox = (r: Rect) => {
          const centerX = r.x + r.w * 0.5;
          const centerZ = r.y + r.h * 0.5;

          return {
            origin: {
              x: (wallOrigin.x - wallSize.x * 0.5) + centerX,
              y: wallOrigin.y,
              z: (wallOrigin.z - wallSize.z * 0.5) + centerZ
            },
            size: {
              x: r.w,
              y: wallSize.y, // Thickness
              z: r.h
            }
          };
        };
      } else { // east or west
        // Wall spans Y and Z
        wallRect = { x: 0, y: 0, w: wallSize.y, h: wallSize.z };

        getHoleRect = (o: OpeningDef) => {
          const localY = o.position.y + wallSize.y * 0.5;
          const localZ = o.position.z + wallSize.z * 0.5;
          return {
            x: localY - o.size.y * 0.5,
            y: localZ - o.size.z * 0.5,
            w: o.size.y,
            h: o.size.z
          };
        };

        convertRectToBox = (r: Rect) => {
          const centerY = r.x + r.w * 0.5;
          const centerZ = r.y + r.h * 0.5;
          return {
            origin: {
              x: wallOrigin.x,
              y: (wallOrigin.y - wallSize.y * 0.5) + centerY,
              z: (wallOrigin.z - wallSize.z * 0.5) + centerZ
            },
            size: {
              x: wallSize.x, // Thickness
              y: r.w,
              z: r.h
            }
          };
        };
      }

      const holes = wallOpenings.map(getHoleRect);
      const pieces = subtractRects(wallRect, holes);

      for (const p of pieces) {
        const boxParams = convertRectToBox(p);
        this.addBrush(box({
          origin: boxParams.origin,
          size: boxParams.size,
          texture: params.wallTexture
        }));
      }
    };

    // North Wall (Y+)
    // Spans X, Thickness Y
    processWall('north',
      { x: params.origin.x, y: maxs.y - t * 0.5, z: params.origin.z },
      { x: params.size.x, y: t, z: wallHeight }
    );

    // South Wall (Y-)
    processWall('south',
      { x: params.origin.x, y: mins.y + t * 0.5, z: params.origin.z },
      { x: params.size.x, y: t, z: wallHeight }
    );

    // East Wall (X+)
    // Spans Y, Thickness X
    // Width along Y is size.y - 2*t
    const ewWidth = params.size.y - 2 * t;

    processWall('east',
      { x: maxs.x - t * 0.5, y: params.origin.y, z: params.origin.z },
      { x: t, y: ewWidth, z: wallHeight }
    );

    // West Wall (X-)
    processWall('west',
      { x: mins.x + t * 0.5, y: params.origin.y, z: params.origin.z },
      { x: t, y: ewWidth, z: wallHeight }
    );

    return this;
  }

  addCorridor(params: CorridorParams): this {
    const diff = subtractVec3(params.end, params.start);
    const t = params.wallThickness ?? 16;

    // Check alignment
    const isX = Math.abs(diff.y) < 0.1 && Math.abs(diff.z) < 0.1;
    const isY = Math.abs(diff.x) < 0.1 && Math.abs(diff.z) < 0.1;

    if (!isX && !isY) {
      throw new Error('Only axis-aligned corridors are supported in MVP');
    }

    const center = scaleVec3(addVec3(params.start, params.end), 0.5);

    if (isX) {
      // Along X axis
      const size = { x: Math.abs(diff.x), y: params.width, z: params.height };

      // Floor
      this.addBrush(box({
        origin: { x: center.x, y: center.y, z: center.z - params.height * 0.5 + t * 0.5 },
        size: { x: size.x, y: size.y, z: t },
        texture: params.texture
      }));
      // Ceiling
      this.addBrush(box({
        origin: { x: center.x, y: center.y, z: center.z + params.height * 0.5 - t * 0.5 },
        size: { x: size.x, y: size.y, z: t },
        texture: params.texture
      }));
      // Wall 1 (Y-)
      this.addBrush(box({
        origin: { x: center.x, y: center.y - params.width * 0.5 + t * 0.5, z: center.z },
        size: { x: size.x, y: t, z: size.z - 2 * t },
        texture: params.texture
      }));
      // Wall 2 (Y+)
      this.addBrush(box({
        origin: { x: center.x, y: center.y + params.width * 0.5 - t * 0.5, z: center.z },
        size: { x: size.x, y: t, z: size.z - 2 * t },
        texture: params.texture
      }));
    } else {
      // Along Y axis
      const size = { x: params.width, y: Math.abs(diff.y), z: params.height };

      // Floor
      this.addBrush(box({
        origin: { x: center.x, y: center.y, z: center.z - params.height * 0.5 + t * 0.5 },
        size: { x: size.x, y: size.y, z: t },
        texture: params.texture
      }));
      // Ceiling
      this.addBrush(box({
        origin: { x: center.x, y: center.y, z: center.z + params.height * 0.5 - t * 0.5 },
        size: { x: size.x, y: size.y, z: t },
        texture: params.texture
      }));
      // Wall 1 (X-)
      this.addBrush(box({
        origin: { x: center.x - params.width * 0.5 + t * 0.5, y: center.y, z: center.z },
        size: { x: t, y: size.y, z: size.z - 2 * t },
        texture: params.texture
      }));
      // Wall 2 (X+)
      this.addBrush(box({
        origin: { x: center.x + params.width * 0.5 - t * 0.5, y: center.y, z: center.z },
        size: { x: t, y: size.y, z: size.z - 2 * t },
        texture: params.texture
      }));
    }

    return this;
  }

  addStairs(params: StairsParams): this {
    const steps = stairs(params);
    this.addBrushes(steps);
    return this;
  }

  // From parsed map (stub)
  fromParsedMap(_map: ParsedMap): this {
    throw new Error('Method not implemented.');
  }

  // Build final BSP (stub)
  build(): BuildResult {
    const start = performance.now();
    return {
      bsp: {} as BspData,
      stats: {
        brushCount: this.brushes.length,
        planeCount: 0,
        nodeCount: 0,
        leafCount: 0,
        faceCount: 0,
        entityCount: this.entities.length + 1, // +1 for worldspawn
        buildTimeMs: performance.now() - start
      },
      warnings: []
    };
  }

  // Validation before build (stub)
  validate(): BuildValidationResult {
    return {
      valid: true,
      errors: [],
      warnings: []
    };
  }
}
