import { normalizePath } from './pak.js';
import { TextureCache, type PreparedTexture } from './texture.js';
import { AudioRegistry, type DecodedAudio } from './audio.js';
import { Md2Loader, type Md2Model } from './md2.js';
import { Md3Loader, type Md3Model } from './md3.js';
import { SpriteLoader, type SpriteModel } from './sprite.js';
import { VirtualFileSystem } from './vfs.js';

type AssetType = 'texture' | 'model' | 'sound' | 'sprite';

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
}

export class AssetManager {
  readonly textures: TextureCache;
  readonly audio: AudioRegistry;
  readonly dependencyTracker: AssetDependencyTracker;
  private readonly md2: Md2Loader;
  private readonly md3: Md3Loader;
  private readonly sprite: SpriteLoader;

  constructor(private readonly vfs: VirtualFileSystem, options: AssetManagerOptions = {}) {
    this.textures = new TextureCache({ capacity: options.textureCacheCapacity ?? 128 });
    this.audio = new AudioRegistry(vfs, { cacheSize: options.audioCacheSize ?? 64 });
    this.dependencyTracker = options.dependencyTracker ?? new AssetDependencyTracker();
    this.md2 = new Md2Loader(vfs);
    this.md3 = new Md3Loader(vfs);
    this.sprite = new SpriteLoader(vfs);
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

  async loadSound(path: string): Promise<DecodedAudio> {
    const audio = await this.audio.load(path);
    const key = this.makeKey('sound', path);
    this.dependencyTracker.register(key);
    this.dependencyTracker.markLoaded(key);
    return audio;
  }

  async loadMd2Model(path: string, textureDependencies: readonly string[] = []): Promise<Md2Model> {
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

  async loadMd3Model(path: string, textureDependencies: readonly string[] = []): Promise<Md3Model> {
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

  async loadSprite(path: string): Promise<SpriteModel> {
    const spriteKey = this.makeKey('sprite', path);
    this.dependencyTracker.register(spriteKey);
    const sprite = await this.sprite.load(path);
    this.dependencyTracker.markLoaded(spriteKey);
    return sprite;
  }

  resetForLevelChange(): void {
    this.textures.clear();
    this.audio.clearAll();
    this.dependencyTracker.reset();
  }

  private makeKey(type: AssetType, path: string): string {
    return `${type}:${normalizePath(path)}`;
  }
}
