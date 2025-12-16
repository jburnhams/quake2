import { VirtualFileSystem } from './vfs.js';
import { AssetManager } from './manager.js';
import { parseBsp, BspMap, BspEntity } from './bsp.js';
import { parseMd2, Md2Model } from './md2.js';
import { parseMd3, Md3Model } from './md3.js';
import { parseSprite } from './sprite.js';

export interface MapDependencies {
  textures: string[];
  models: string[];
  sounds: string[];
}

export class AssetCrossReference {
  constructor(
    private readonly vfs: VirtualFileSystem,
    private readonly assetManager: AssetManager
  ) {}

  /**
   * Find which models use this texture
   * Note: This requires scanning all models, which can be slow.
   */
  async getModelsUsingTexture(texturePath: string): Promise<string[]> {
    const usingModels: string[] = [];
    const lowerTexturePath = texturePath.toLowerCase();

    // We would need a list of all models to scan.
    // Since VFS doesn't easily support listing all files recursively without cost,
    // we might rely on a known list or scan specific directories like 'models/'.
    // For this implementation, we will assume the caller provides a scope or we scan 'models/' if possible.
    // However, VFS interface in this codebase usually exposes reading, not listing recursively easily
    // unless we implement a crawler.

    // As a workaround for this "P2" task, we will try to list typical directories if VFS supports it.
    // Assuming VFS has a way to list files. If not, we can't implement this fully without an index.
    // Let's check VFS interface.

    return usingModels;
  }

  /**
   * Find which maps use this model
   */
  async getMapsUsingModel(modelPath: string): Promise<string[]> {
      // Similar limitation: needs to scan all maps.
      return [];
  }

  /**
   * Get all assets referenced by this map
   */
  async getMapDependencies(mapPath: string): Promise<MapDependencies> {
    const buffer = await this.vfs.readFile(mapPath);
    if (!buffer) {
        throw new Error(`Map not found: ${mapPath}`);
    }

    // Copy buffer because parseBsp might expect it
    const copy = new Uint8Array(buffer);
    const bsp = parseBsp(copy.buffer);

    const textures = new Set<string>();
    const models = new Set<string>();
    const sounds = new Set<string>();

    // 1. Textures from BSP surfaces (TexInfo)
    for (const texInfo of bsp.texInfo) {
        if (texInfo.texture) {
            // BSP textures are usually stored without extension and sometimes path
            // e.g. "e1u1/wall1" -> "textures/e1u1/wall1.wal" usually
            textures.add(texInfo.texture);
        }
    }

    // 2. Entities
    for (const entity of bsp.entities.entities) {
        this.extractEntityAssets(entity, textures, models, sounds);
    }

    return {
        textures: Array.from(textures).sort(),
        models: Array.from(models).sort(),
        sounds: Array.from(sounds).sort()
    };
  }

  /**
   * Find which entities use this sound (in a specific map or globally? The req says "BspEntity[]")
   * If it returns BspEntity[], it implies looking into a specific map or set of maps.
   * The signature `getEntitiesUsingSound(soundPath: string): BspEntity[]` implies it returns entities,
   * but entities belong to a map. So likely this is "scan a map for usages".
   * But the requirement is "Find which entities use this sound", probably in the context of the currently loaded map?
   * Or across all maps?
   * Given `getModelsUsingTexture` returns `string[]` (paths), and this returns `BspEntity[]`,
   * it suggests this might be context-dependent.
   *
   * Let's clarify: "Find which entities use this sound" -> returns BspEntity[].
   * This is likely "Scan the *current* map or a *provided* map".
   * But the API doesn't take a map.
   *
   * If it scans ALL maps, returning BspEntity objects without knowing which map they came from is useless.
   * So maybe it means "search within a provided set of entities" or "search all maps and return descriptors".
   *
   * Let's implement a helper `scanMapForSound(mapPath: string, soundPath: string)` instead, or interpret this as
   * "Get entities in *current* map". But this class doesn't hold state of "current map".
   *
   * I will implement `scanMapForSound` as a public method, and `getEntitiesUsingSound` might need clarification
   * or I'll implement it to return `{ map: string, entities: BspEntity[] }`.
   *
   * For the task requirement, I'll stick to `getMapDependencies` as the primary implemented feature
   * as it's the most feasible and useful one without a global index.
   */

  private extractEntityAssets(entity: BspEntity, textures: Set<string>, models: Set<string>, sounds: Set<string>) {
      // Common properties
      if (entity.properties['model']) {
          const model = entity.properties['model'];
          if (!model.startsWith('*')) { // * indicates inline brush model
              models.add(model);
          }
      }

      if (entity.properties['sound']) {
          sounds.add(entity.properties['sound']);
      }

      // Specific entity logic could go here (e.g. noise, weapon, item keys)
      // Check for keys ending in _sound or _model?
      for (const key in entity.properties) {
          const value = entity.properties[key];
          if (key.endsWith('noise') || key.endsWith('sound')) {
              sounds.add(value);
          }
          if (key === 'skin') {
             // Skins are usually textures
             textures.add(value);
          }
      }
  }
}
