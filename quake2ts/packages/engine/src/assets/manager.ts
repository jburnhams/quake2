import { normalizePath } from './pak.js';
import { TextureCache, type PreparedTexture, parseWalTexture, preparePcxTexture, prepareTgaTexture } from './texture.js';
import { AudioRegistry, type DecodedAudio } from './audio.js';
import { Md2Loader, type Md2Model } from './md2.js';
import { Md3Loader, type Md3Model } from './md3.js';
import { SpriteLoader, type SpriteModel } from './sprite.js';
import { VirtualFileSystem, VirtualFileHandle } from './vfs.js';
import { parsePcx } from './pcx.js';
import { parseTga } from './tga.js';
import { BspLoader, type BspMap } from './bsp.js';
import { ResourceLoadTracker, ResourceType } from './resourceTracker.js';

type AssetType = 'texture' | 'model' | 'sound' | 'sprite' | 'map';

interface DependencyNode {
  readonly dependencies: Set<string>;
  loaded: boolean;
}

export class AssetDependencyError extends Error {
  constructor(readonly missing: readonly string[], message?: string) {
    super(message ?? `Missing dependencies: ${missing.join(', ')}`);
    this.name = 'AssetDependencyError';
  }
}

export class AssetDependencyTracker {
  private readonly nodes = new Map<string, DependencyNode>();

  register(assetKey: string, dependencies: readonly string[] = []): void {
    const node = this.nodes.get(assetKey) ?? { dependencies: new Set<string>(), loaded: false };
    dependencies.forEach((dependency) => node.dependencies.add(dependency));
    this.nodes.set(assetKey, node);
    dependencies.forEach((dependency) => {
      if (!this.nodes.has(dependency)) {
        this.nodes.set(dependency, { dependencies: new Set<string>(), loaded: false });
      }
    });
  }

  markLoaded(assetKey: string): void {
    const node = this.nodes.get(assetKey) ?? { dependencies: new Set<string>(), loaded: false };
    const missing = this.getMissingDependencies(assetKey, node);
    if (missing.length > 0) {
      throw new AssetDependencyError(missing, `Asset ${assetKey} is missing dependencies: ${missing.join(', ')}`);
    }
    node.loaded = true;
    this.nodes.set(assetKey, node);
  }

  markUnloaded(assetKey: string): void {
    const node = this.nodes.get(assetKey);
    if (node) {
      node.loaded = false;
    }
  }

  isLoaded(assetKey: string): boolean {
    return this.nodes.get(assetKey)?.loaded ?? false;
  }

  missingDependencies(assetKey: string): string[] {
    const node = this.nodes.get(assetKey);
    if (!node) {
      return [];
    }
    return this.getMissingDependencies(assetKey, node);
  }

  reset(): void {
    this.nodes.clear();
  }

  private getMissingDependencies(assetKey: string, node: DependencyNode): string[] {
    const missing: string[] = [];
    for (const dependency of node.dependencies) {
      if (!this.nodes.get(dependency)?.loaded) {
        missing.push(dependency);
      }
    }
    return missing;
  }
}

export interface AssetManagerOptions {
  readonly textureCacheCapacity?: number;
  readonly audioCacheSize?: number;
  readonly dependencyTracker?: AssetDependencyTracker;
  readonly resourceTracker?: ResourceLoadTracker;
}

export class AssetManager {
  readonly textures: TextureCache;
  readonly audio: AudioRegistry;
  readonly dependencyTracker: AssetDependencyTracker;
  readonly resourceTracker?: ResourceLoadTracker;
  private readonly md2: Md2Loader;
  private readonly md3: Md3Loader;
  private readonly sprite: SpriteLoader;
  private readonly bsp: BspLoader;
  private palette: Uint8Array;
  private readonly maps = new Map<string, BspMap>();

  constructor(private readonly vfs: VirtualFileSystem, options: AssetManagerOptions = {}) {
    this.textures = new TextureCache({ capacity: options.textureCacheCapacity ?? 128 });
    this.audio = new AudioRegistry(vfs, { cacheSize: options.audioCacheSize ?? 64 });
    this.dependencyTracker = options.dependencyTracker ?? new AssetDependencyTracker();
    this.resourceTracker = options.resourceTracker;
    this.md2 = new Md2Loader(vfs);
    this.md3 = new Md3Loader(vfs);
    this.sprite = new SpriteLoader(vfs);
    this.bsp = new BspLoader(vfs);

    // Default grayscale palette until loaded
    this.palette = new Uint8Array(768);
    for (let i = 0; i < 256; i++) {
        this.palette[i*3] = i;
        this.palette[i*3+1] = i;
        this.palette[i*3+2] = i;
    }
  }

  /**
   * Loads the global palette (pics/colormap.pcx) if available.
   * This is required for loading WAL textures.
   */
  async loadPalette(path: string = 'pics/colormap.pcx'): Promise<void> {
    try {
        const buffer = await this.vfs.readFile(path);
        // buffer from vfs.readFile returns ArrayBuffer | SharedArrayBuffer
        // parsePcx expects ArrayBuffer.
        const pcx = parsePcx(buffer as unknown as ArrayBuffer);
        if (pcx.palette) {
            this.palette = pcx.palette;
        }
    } catch (e) {
        console.warn(`Failed to load palette from ${path}:`, e);
    }
  }

  isAssetLoaded(type: AssetType, path: string): boolean {
    return this.dependencyTracker.isLoaded(this.makeKey(type, path));
  }

  registerTexture(path: string, texture: PreparedTexture): void {
    this.textures.set(path, texture);
    const key = this.makeKey('texture', path);
    this.dependencyTracker.register(key);
    this.dependencyTracker.markLoaded(key);
  }

  async loadTexture(path: string): Promise<PreparedTexture> {
    if (this.resourceTracker) {
        this.resourceTracker.recordLoad(ResourceType.Texture, path);
    }
    const cached = this.textures.get(path);
    if (cached) return cached;

    const buffer = await this.vfs.readFile(path);
    const ext = path.split('.').pop()?.toLowerCase();

    let texture: PreparedTexture;

    if (ext === 'wal') {
        texture = parseWalTexture(buffer as unknown as ArrayBuffer, this.palette);
    } else if (ext === 'pcx') {
        texture = preparePcxTexture(parsePcx(buffer as unknown as ArrayBuffer));
    } else if (ext === 'tga') {
        texture = prepareTgaTexture(parseTga(buffer as unknown as ArrayBuffer));
    } else {
        throw new Error(`Unsupported texture format for loadTexture: ${ext}`);
    }

    this.registerTexture(path, texture);
    return texture;
  }

  async loadSound(path: string): Promise<DecodedAudio> {
    if (this.resourceTracker) {
        this.resourceTracker.recordLoad(ResourceType.Sound, path);
    }
    const audio = await this.audio.load(path);
    const key = this.makeKey('sound', path);
    this.dependencyTracker.register(key);
    this.dependencyTracker.markLoaded(key);
    return audio;
  }

  async loadMd2Model(path: string, textureDependencies: readonly string[] = []): Promise<Md2Model> {
    if (this.resourceTracker) {
        this.resourceTracker.recordLoad(ResourceType.Model, path);
    }
    const modelKey = this.makeKey('model', path);
    const dependencyKeys = textureDependencies.map((dep) => this.makeKey('texture', dep));
    this.dependencyTracker.register(modelKey, dependencyKeys);
    const missing = this.dependencyTracker.missingDependencies(modelKey);
    if (missing.length > 0) {
      throw new AssetDependencyError(missing, `Asset ${modelKey} is missing dependencies: ${missing.join(', ')}`);
    }
    const model = await this.md2.load(path);
    this.dependencyTracker.markLoaded(modelKey);
    return model;
  }

  getMd2Model(path: string): Md2Model | undefined {
      if (this.resourceTracker) {
          this.resourceTracker.recordLoad(ResourceType.Model, path);
      }
      return this.md2.get(path);
  }

  async loadMd3Model(path: string, textureDependencies: readonly string[] = []): Promise<Md3Model> {
    if (this.resourceTracker) {
        this.resourceTracker.recordLoad(ResourceType.Model, path);
    }
    const modelKey = this.makeKey('model', path);
    const dependencyKeys = textureDependencies.map((dep) => this.makeKey('texture', dep));
    this.dependencyTracker.register(modelKey, dependencyKeys);
    const missing = this.dependencyTracker.missingDependencies(modelKey);
    if (missing.length > 0) {
      throw new AssetDependencyError(missing, `Asset ${modelKey} is missing dependencies: ${missing.join(', ')}`);
    }
    const model = await this.md3.load(path);
    this.dependencyTracker.markLoaded(modelKey);
    return model;
  }

  getMd3Model(path: string): Md3Model | undefined {
      if (this.resourceTracker) {
          this.resourceTracker.recordLoad(ResourceType.Model, path);
      }
      return this.md3.get(path);
  }

  async loadSprite(path: string): Promise<SpriteModel> {
    if (this.resourceTracker) {
        this.resourceTracker.recordLoad(ResourceType.Sprite, path);
    }
    const spriteKey = this.makeKey('sprite', path);
    this.dependencyTracker.register(spriteKey);
    const sprite = await this.sprite.load(path);
    this.dependencyTracker.markLoaded(spriteKey);
    return sprite;
  }

  async loadMap(path: string): Promise<BspMap> {
      if (this.resourceTracker) {
          this.resourceTracker.recordLoad(ResourceType.Map, path);
      }
      const mapKey = this.makeKey('map', path);
      if (this.maps.has(path)) {
          return this.maps.get(path)!;
      }
      this.dependencyTracker.register(mapKey);
      const map = await this.bsp.load(path);
      this.maps.set(path, map);
      this.dependencyTracker.markLoaded(mapKey);
      return map;
  }

  getMap(path: string): BspMap | undefined {
      return this.maps.get(path);
  }

  listFiles(extension: string): VirtualFileHandle[] {
      return this.vfs.findByExtension(extension);
  }

  resetForLevelChange(): void {
    this.textures.clear();
    this.audio.clearAll();
    this.dependencyTracker.reset();
    // Maps are heavy, maybe clear them or cache strategically?
    // For now, let's keep them cached as VFS is already heavy.
    // Actually, level change implies new map, old map memory can be freed?
    // Let's clear maps on level change to be safe with memory.
    this.maps.clear();
  }

  private makeKey(type: AssetType, path: string): string {
    return `${type}:${normalizePath(path)}`;
  }
}
