import type { ParsedMap } from '../parser/mapParser.js';
import type { BrushDef, EntityDef } from './types.js';

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
  [key: string]: any;
}
export interface CorridorParams {
  [key: string]: any;
}
export interface StairsParams {
  [key: string]: any;
}

export interface ValidationResult {
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

  // High-level primitives (stubs)
  addRoom(params: RoomParams): this {
    throw new Error('Method not implemented.');
  }

  addCorridor(params: CorridorParams): this {
    throw new Error('Method not implemented.');
  }

  addStairs(params: StairsParams): this {
    throw new Error('Method not implemented.');
  }

  // From parsed map (stub)
  fromParsedMap(map: ParsedMap): this {
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
  validate(): ValidationResult {
    return {
      valid: true,
      errors: [],
      warnings: []
    };
  }
}
