import { mat3 } from 'gl-matrix';
import { Texture2D } from './resources.js';

export enum BlendMode {
  OPAQUE,
  ALPHA,
  ADDITIVE,
}

export interface MaterialOptions {
  readonly textures: (WebGLTexture | Texture2D)[];
  readonly fps?: number;
  readonly blendMode?: BlendMode;
  readonly twoSided?: boolean;
  readonly depthWrite?: boolean;
  readonly scroll?: readonly [number, number];
  readonly warp?: boolean;
}

export class Material {
  readonly blendMode: BlendMode;
  readonly twoSided: boolean;
  readonly depthWrite: boolean;
  readonly warp: boolean;
  readonly scroll: readonly [number, number];

  private readonly textures: (WebGLTexture | Texture2D)[];
  private readonly fps: number;
  private currentIndex: number = 0;
  private lastAnimationTime: number = 0;
  private lastTime: number = 0;

  constructor(options: MaterialOptions) {
    this.textures = options.textures;
    this.fps = options.fps ?? 10;
    this.blendMode = options.blendMode ?? BlendMode.OPAQUE;
    this.twoSided = options.twoSided ?? false;
    this.depthWrite = options.depthWrite ?? (this.blendMode === BlendMode.OPAQUE);
    this.warp = options.warp ?? false;
    this.scroll = options.scroll ?? [0, 0];
  }

  update(time: number): void {
    if (this.textures.length > 1) {
      if (time - this.lastAnimationTime >= 1.0 / this.fps) {
        this.currentIndex = (this.currentIndex + 1) % this.textures.length;
        this.lastAnimationTime = time;
      }
    }
    this.lastTime = time;
  }

  get texture(): WebGLTexture | Texture2D | null {
    if (this.textures.length === 0) return null;
    return this.textures[this.currentIndex];
  }

  get scrollOffset(): readonly [number, number] {
    if (this.scroll[0] === 0 && this.scroll[1] === 0) {
      return [0, 0];
    }
    // Match Quake II's negative scroll direction
    const cycle = (this.lastTime * 0.25) % 1;
    return [-cycle * this.scroll[0], -cycle * this.scroll[1]];
  }
}

export class MaterialManager {
  private readonly materials: Map<string, Material> = new Map();

  getMaterial(name: string): Material | undefined {
    return this.materials.get(name);
  }

  registerMaterial(name: string, options: MaterialOptions): Material {
    const material = new Material(options);
    this.materials.set(name, material);
    return material;
  }

  update(time: number): void {
    for (const material of this.materials.values()) {
        material.update(time);
    }
  }

  clear(): void {
    this.materials.clear();
  }
}
