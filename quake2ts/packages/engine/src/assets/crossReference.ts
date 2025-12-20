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
   */
  async getModelsUsingTexture(texturePath: string): Promise<string[]> {
    const usingModels: string[] = [];
    const lowerTexturePath = texturePath.toLowerCase();

    // Scan MD2 models
    const md2Files = this.vfs.findByExtension('md2');
    for (const file of md2Files) {
        try {
            const buffer = await this.vfs.readFile(file.path);
            const model = parseMd2(buffer.slice().buffer);
            for (const skin of model.skins) {
                if (skin.name.toLowerCase() === lowerTexturePath) {
                    usingModels.push(file.path);
                    break;
                }
            }
        } catch (e) {
            console.warn(`Failed to process MD2 ${file.path} for cross-ref`, e);
        }
    }

    // Scan MD3 models
    const md3Files = this.vfs.findByExtension('md3');
    for (const file of md3Files) {
        try {
            const buffer = await this.vfs.readFile(file.path);
            const model = parseMd3(buffer.slice().buffer);
            for (const surface of model.surfaces) {
                for (const shader of surface.shaders) {
                    if (shader.name.toLowerCase() === lowerTexturePath) {
                        usingModels.push(file.path);
                        break; // Found usage in this model, no need to check other shaders in this file
                    }
                }
                if (usingModels[usingModels.length - 1] === file.path) break;
            }
        } catch (e) {
             console.warn(`Failed to process MD3 ${file.path} for cross-ref`, e);
        }
    }

    return usingModels;
  }

  /**
   * Find which maps use this model
   */
  async getMapsUsingModel(modelPath: string): Promise<string[]> {
    const usingMaps: string[] = [];
    const lowerModelPath = modelPath.toLowerCase();

    const bspFiles = this.vfs.findByExtension('bsp');
    for (const file of bspFiles) {
        try {
            const buffer = await this.vfs.readFile(file.path);
            const bsp = parseBsp(buffer.slice().buffer);

            let found = false;
            for (const entity of bsp.entities.entities) {
                if (entity.properties['model']?.toLowerCase() === lowerModelPath) {
                    found = true;
                    break;
                }
                // Check extra keys just in case
                for (const key in entity.properties) {
                    if (key.endsWith('model') && entity.properties[key]?.toLowerCase() === lowerModelPath) {
                        found = true;
                        break;
                    }
                }
                if (found) break;
            }

            if (found) {
                usingMaps.push(file.path);
            }
        } catch (e) {
            console.warn(`Failed to process BSP ${file.path} for cross-ref`, e);
        }
    }
    return usingMaps;
  }

  /**
   * Find which entities use this sound.
   * Scans all maps and returns entities that reference the sound.
   * Note: The BspEntity object doesn't inherently store its origin map,
   * so checking the context requires correlating with the map iteration if needed by the caller,
   * but the interface is just BspEntity[].
   */
  async getEntitiesUsingSound(soundPath: string): Promise<BspEntity[]> {
    const usingEntities: BspEntity[] = [];
    const lowerSoundPath = soundPath.toLowerCase();

    const bspFiles = this.vfs.findByExtension('bsp');
    for (const file of bspFiles) {
        try {
            const buffer = await this.vfs.readFile(file.path);
            const bsp = parseBsp(buffer.slice().buffer);

            for (const entity of bsp.entities.entities) {
                let found = false;
                if (entity.properties['sound']?.toLowerCase() === lowerSoundPath) {
                    found = true;
                }
                else if (entity.properties['noise']?.toLowerCase() === lowerSoundPath) {
                    found = true;
                }
                else {
                    for (const key in entity.properties) {
                        if ((key.endsWith('sound') || key.endsWith('noise')) && entity.properties[key]?.toLowerCase() === lowerSoundPath) {
                            found = true;
                            break;
                        }
                    }
                }

                if (found) {
                    usingEntities.push(entity);
                }
            }
        } catch (e) {
            console.warn(`Failed to process BSP ${file.path} for cross-ref`, e);
        }
    }
    return usingEntities;
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
