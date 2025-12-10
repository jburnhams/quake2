import { BspMap, BspEntity, BspLoader, BspFace } from './bsp.js';

export interface MapStatistics {
  readonly entityCount: number;
  readonly surfaceCount: number;
  readonly lightmapCount: number;
  readonly vertexCount: number;
  readonly bounds: {
    readonly mins: [number, number, number];
    readonly maxs: [number, number, number];
  };
}

export class MapAnalyzer {
  constructor(private readonly loader: BspLoader) {}

  async getMapStatistics(mapName: string): Promise<MapStatistics> {
    const map = await this.loader.load(mapName);

    // Calculate lightmap count: iterate through faces and count those with valid light offsets
    // Note: Quake 2 BSPs store lightmaps in a single lump, but we can count unique references or total bytes.
    // However, the prompt asks for "lightmap count". Faces reference offsets.
    // A standard interpretation is the number of faces that have lightmaps.
    // Or we could try to determine the number of distinct lightmap pages if they were paginated,
    // but here they are just offsets.
    // Let's count faces with lightmaps.
    const lightmapCount = map.faces.filter((f: BspFace) => f.lightOffset !== -1).length;

    // Bounds from worldspawn model (model 0)
    const worldModel = map.models[0];
    const bounds = worldModel ? {
      mins: worldModel.mins,
      maxs: worldModel.maxs
    } : {
      mins: [0, 0, 0] as [number, number, number],
      maxs: [0, 0, 0] as [number, number, number]
    };

    return {
      entityCount: map.entities.entities.length,
      surfaceCount: map.faces.length,
      lightmapCount,
      vertexCount: map.vertices.length,
      bounds
    };
  }

  async getUsedTextures(mapName: string): Promise<string[]> {
    const map = await this.loader.load(mapName);
    const textures = new Set<string>();

    // From TexInfo
    for (const info of map.texInfo) {
      if (info.texture) {
        textures.add(info.texture);
      }
    }

    return Array.from(textures).sort();
  }

  async getUsedModels(mapName: string): Promise<string[]> {
    const map = await this.loader.load(mapName);
    const models = new Set<string>();

    for (const ent of map.entities.entities) {
      // Check for 'model' property not starting with * (which are inline models)
      if (ent.properties['model'] && !ent.properties['model'].startsWith('*')) {
        models.add(ent.properties['model']);
      }

      // Also check specific entities that might use other keys for models if any?
      // Standard Quake 2 is usually just 'model'.
      // Weapon pickups might have implicit models, but the request implies explicit references in the map data.
    }

    return Array.from(models).sort();
  }

  async getUsedSounds(mapName: string): Promise<string[]> {
    const map = await this.loader.load(mapName);
    const sounds = new Set<string>();

    for (const ent of map.entities.entities) {
        // 'noise' property is commonly used for sounds
        if (ent.properties['noise']) {
            sounds.add(ent.properties['noise']);
        }

        // target_speaker uses 'noise'
        // worldspawn might have 'sound'? No, usually not.

        // ambient_generic? (Quake 1 / Half-Life, but Quake 2 uses target_speaker)

        // func_door/button/etc have 'sound_start', 'sound_stop', etc?
        // Let's check keys ending in 'sound' or 'noise'.
        for (const [key, value] of Object.entries(ent.properties)) {
            if ((key === 'noise' || key.endsWith('_sound') || key === 'sound') && typeof value === 'string') {
                 sounds.add(value);
            }
        }
    }

    return Array.from(sounds).sort();
  }
}
