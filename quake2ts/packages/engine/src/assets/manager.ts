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

export type AssetType = 'texture' | 'model' | 'sound' | 'sprite' | 'map';

export interface MemoryUsage {
    textures: number;
    audio: number;
    heapTotal?: number;
    heapUsed?: number;
}

export interface MemoryBudget {
    textureMemoryLimit?: number;
    textureCacheCapacity?: number;
    audioCacheSize?: number;
}

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

interface AssetTask {
    path: string;
    type: AssetType;
    priority: number;
    resolve: (value: any) => void;
    reject: (err: any) => void;
}

export interface AssetManagerOptions {
  readonly textureCacheCapacity?: number;
  readonly textureMemoryLimit?: number;
  readonly audioCacheSize?: number;
  readonly dependencyTracker?: AssetDependencyTracker;
  readonly resourceTracker?: ResourceLoadTracker;
  readonly maxConcurrentLoads?: number;
  readonly bspWorkerPath?: string;
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

  private readonly loadQueue: AssetTask[] = [];
  private activeLoads = 0;
  private readonly maxConcurrentLoads: number;

  constructor(private readonly vfs: VirtualFileSystem, options: AssetManagerOptions = {}) {
    this.textures = new TextureCache({
        capacity: options.textureCacheCapacity ?? 128,
        maxMemory: options.textureMemoryLimit
    });
    this.audio = new AudioRegistry(vfs, { cacheSize: options.audioCacheSize ?? 64 });
    this.dependencyTracker = options.dependencyTracker ?? new AssetDependencyTracker();
    this.resourceTracker = options.resourceTracker;
    this.md2 = new Md2Loader(vfs);
    this.md3 = new Md3Loader(vfs);
    this.sprite = new SpriteLoader(vfs);
    this.bsp = new BspLoader(vfs, { useWorker: !!options.bspWorkerPath, workerPath: options.bspWorkerPath });
    this.maxConcurrentLoads = options.maxConcurrentLoads ?? 4;

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
        const stats = this.vfs.stat(path);
        this.resourceTracker.recordLoad(ResourceType.Texture, path, stats?.size, stats?.sourcePak);
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
        const stats = this.vfs.stat(path);
        this.resourceTracker.recordLoad(ResourceType.Sound, path, stats?.size, stats?.sourcePak);
    }
    const audio = await this.audio.load(path);
    const key = this.makeKey('sound', path);
    this.dependencyTracker.register(key);
    this.dependencyTracker.markLoaded(key);
    return audio;
  }

  async loadMd2Model(path: string, textureDependencies: readonly string[] = []): Promise<Md2Model> {
    if (this.resourceTracker) {
        const stats = this.vfs.stat(path);
        this.resourceTracker.recordLoad(ResourceType.Model, path, stats?.size, stats?.sourcePak);
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
          const stats = this.vfs.stat(path);
          this.resourceTracker.recordLoad(ResourceType.Model, path, stats?.size, stats?.sourcePak);
      }
      return this.md2.get(path);
  }

  async loadMd3Model(path: string, textureDependencies: readonly string[] = []): Promise<Md3Model> {
    if (this.resourceTracker) {
        const stats = this.vfs.stat(path);
        this.resourceTracker.recordLoad(ResourceType.Model, path, stats?.size, stats?.sourcePak);
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
          const stats = this.vfs.stat(path);
          this.resourceTracker.recordLoad(ResourceType.Model, path, stats?.size, stats?.sourcePak);
      }
      return this.md3.get(path);
  }

  async loadSprite(path: string): Promise<SpriteModel> {
    if (this.resourceTracker) {
        const stats = this.vfs.stat(path);
        this.resourceTracker.recordLoad(ResourceType.Sprite, path, stats?.size, stats?.sourcePak);
    }
    const spriteKey = this.makeKey('sprite', path);
    this.dependencyTracker.register(spriteKey);
    const sprite = await this.sprite.load(path);
    this.dependencyTracker.markLoaded(spriteKey);
    return sprite;
  }

  async loadMap(path: string): Promise<BspMap> {
      if (this.resourceTracker) {
          const stats = this.vfs.stat(path);
          this.resourceTracker.recordLoad(ResourceType.Map, path, stats?.size, stats?.sourcePak);
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
    this.maps.clear();
    this.loadQueue.length = 0; // Clear pending loads
  }

  getMemoryUsage(): MemoryUsage {
      let heapTotal = 0;
      let heapUsed = 0;
      if (typeof process !== 'undefined' && process.memoryUsage) {
          const mem = process.memoryUsage();
          heapTotal = mem.heapTotal;
          heapUsed = mem.heapUsed;
      }

      return {
          textures: this.textures.memoryUsage,
          audio: this.audio.size, // Approximation or update AudioRegistry to track bytes
          heapTotal,
          heapUsed
      };
  }

  enforceMemoryBudget(budget: MemoryBudget): void {
    if (budget.textureMemoryLimit !== undefined) {
      this.textures.maxMemory = budget.textureMemoryLimit;
    }
    if (budget.textureCacheCapacity !== undefined) {
      this.textures.capacity = budget.textureCacheCapacity;
    }
    if (budget.audioCacheSize !== undefined) {
      this.audio.capacity = budget.audioCacheSize;
    }
  }

  clearCache(type: AssetType): void {
      switch (type) {
          case 'texture':
              this.textures.clear();
              break;
          case 'sound':
              this.audio.clearAll();
              break;
          case 'map':
              this.maps.clear();
              break;
      }
  }

  /**
   * Preload a list of assets with low priority.
   */
  async preloadAssets(paths: string[]): Promise<void> {
      const promises = paths.map(path => {
          const type = this.detectAssetType(path);
          if (type) {
              return this.queueLoad(path, type, 0); // Low priority 0
          }
          return Promise.resolve();
      });
      await Promise.all(promises);
  }

  /**
   * Queue an asset for loading.
   * @param path The path to the asset.
   * @param type The type of asset.
   * @param priority Higher priority assets are loaded first. Default 1 (High).
   */
  queueLoad<T>(path: string, type: AssetType, priority: number = 1): Promise<T> {
      // If already loaded, return immediately
      if (type === 'texture' && this.textures.get(path)) {
          return Promise.resolve(this.textures.get(path) as unknown as T);
      }
      // Add similar checks for other types if possible

      return new Promise<T>((resolve, reject) => {
          this.loadQueue.push({
              path,
              type,
              priority,
              resolve,
              reject
          });
          this.loadQueue.sort((a, b) => b.priority - a.priority);
          this.processQueue();
      });
  }

  private async processQueue() {
      if (this.activeLoads >= this.maxConcurrentLoads || this.loadQueue.length === 0) {
          return;
      }

      const task = this.loadQueue.shift()!;
      this.activeLoads++;

      try {
          let result;
          switch (task.type) {
              case 'texture':
                  result = await this.loadTexture(task.path);
                  break;
              case 'sound':
                  result = await this.loadSound(task.path);
                  break;
              case 'model':
                  // Heuristic: MD2 vs MD3
                  if (task.path.endsWith('.md2')) {
                      result = await this.loadMd2Model(task.path);
                  } else if (task.path.endsWith('.md3')) {
                      result = await this.loadMd3Model(task.path);
                  }
                  break;
              case 'sprite':
                  result = await this.loadSprite(task.path);
                  break;
              case 'map':
                  result = await this.loadMap(task.path);
                  break;
              default:
                  throw new Error(`Unknown asset type ${task.type}`);
          }
          task.resolve(result);
      } catch (err) {
          task.reject(err);
      } finally {
          this.activeLoads--;
          this.processQueue();
      }
  }

  private detectAssetType(path: string): AssetType | null {
      const ext = path.split('.').pop()?.toLowerCase();
      if (!ext) return null;
      if (['wal', 'pcx', 'tga', 'png', 'jpg'].includes(ext)) return 'texture';
      if (['wav', 'ogg'].includes(ext)) return 'sound';
      if (['md2', 'md3'].includes(ext)) return 'model';
      if (['sp2'].includes(ext)) return 'sprite';
      if (['bsp'].includes(ext)) return 'map';
      return null;
  }

  private makeKey(type: AssetType, path: string): string {
    return `${type}:${normalizePath(path)}`;
  }
}
