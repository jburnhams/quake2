import { BspLoader, BspMap } from '../assets/bsp.js';
import { createBspSurfaces } from '../render/bsp/surface.js';
import { generateBspGeometryData } from '../render/bsp/generator.js';
import { MapGeometry, TextureReference, LightmapData } from '../render/types.js';

export class HeadlessMapLoader {
  constructor(private readonly loader: BspLoader) {}

  async load(mapName: string): Promise<BspMap> {
      return this.loader.load(mapName);
  }

  async getMapGeometry(mapName: string): Promise<MapGeometry> {
    const map = await this.loader.load(mapName);
    const surfaces = createBspSurfaces(map);
    const data = generateBspGeometryData(surfaces);

    const worldModel = map.models[0];
    const bounds = worldModel ? {
        mins: worldModel.mins,
        maxs: worldModel.maxs
    } : {
        mins: [0,0,0] as [number, number, number],
        maxs: [0,0,0] as [number, number, number]
    };

    return {
      vertices: data.vertices,
      indices: data.indices,
      bounds
    };
  }

  async getMapTextures(mapName: string): Promise<TextureReference[]> {
     const map = await this.loader.load(mapName);
     const textures = new Map<string, TextureReference>();

     for (const tex of map.texInfo) {
         if (tex.texture && !textures.has(tex.texture)) {
             textures.set(tex.texture, {
                 name: tex.texture,
                 flags: tex.flags
             });
         }
     }

     return Array.from(textures.values()).sort((a, b) => a.name.localeCompare(b.name));
  }

  async getMapLightmaps(mapName: string): Promise<LightmapData[]> {
    const map = await this.loader.load(mapName);
    const surfaces = createBspSurfaces(map);

    // Use generator to get the atlas
    const data = generateBspGeometryData(surfaces);

    if (data.lightmapAtlas) {
        return [{
            width: data.atlasSize,
            height: data.atlasSize,
            data: data.lightmapAtlas
        }];
    }

    return [];
  }
}
