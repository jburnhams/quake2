import { BspMap } from '../../assets/bsp.js';
import { VertexArray, VertexBuffer, IndexBuffer, Texture2D } from '../resources.js';
import { generateBspGeometryData } from './generator.js';

export interface BspSurfaceLightmap {
  width: number;
  height: number;
  data: Uint8Array;
}

export interface BspSurfaceInput {
  faceIndex: number;
  textureName: string;
  flags: number;
  vertices: Float32Array; // Interleaved: x, y, z, u, v, lu, lv
  vertexCount: number;
  styles: [number, number, number, number];
  lightmap?: BspSurfaceLightmap;
}

export interface BspBatch {
  textureName: string;
  offset: number;
  count: number;
  flags: number;
  styleIndices: readonly number[];
  styleLayers: readonly number[]; // [layer0, layer1, layer2, layer3] - -1 for none
  lightmapOffset?: number;
}

export interface BspGeometry {
  vao: VertexArray;
  vbo: VertexBuffer;
  ibo: IndexBuffer;
  indexCount: number;
  batches: BspBatch[];
  lightmapAtlas: Texture2D | null;
}

export function buildBspGeometry(
  gl: WebGL2RenderingContext,
  surfaces: BspSurfaceInput[],
  map?: BspMap,
  options?: {
    hiddenClassnames?: Set<string>;
  },
): BspGeometry {

  // Reuse the logic in map parameter to filter faces in the generator if needed,
  // but for now let's just do the filtering here before passing to generator if we want to be consistent
  // with previous logic.
  // Actually, the previous logic filtered the surfaces list itself.

  let filteredSurfaces = surfaces;

  if (map && options?.hiddenClassnames && options.hiddenClassnames.size > 0) {
    const hiddenFaces = new Set<number>();

    for (const entity of map.entities.entities) {
      if (entity.classname && options.hiddenClassnames.has(entity.classname)) {
        const modelProp = entity.properties['model'];
        if (modelProp && modelProp.startsWith('*')) {
          const modelIndex = parseInt(modelProp.substring(1), 10);
          if (!isNaN(modelIndex) && modelIndex >= 0 && modelIndex < map.models.length) {
            const model = map.models[modelIndex];
            for (let i = 0; i < model.numFaces; i++) {
              hiddenFaces.add(model.firstFace + i);
            }
          }
        }
      }
    }

    if (hiddenFaces.size > 0) {
      filteredSurfaces = surfaces.filter((s) => !hiddenFaces.has(s.faceIndex));
    }
  }

  // Use the generator
  const data = generateBspGeometryData(filteredSurfaces);

  // Create GPU Resources
  const vao = new VertexArray(gl);
  const vbo = new VertexBuffer(gl, gl.STATIC_DRAW);
  const ibo = new IndexBuffer(gl, gl.STATIC_DRAW);

  vbo.upload(data.vertices);
  ibo.upload(data.indices);

  // Stride 8 floats = 32 bytes
  // 0: pos (3)
  // 1: tex (2)
  // 2: lm (2)
  // 3: lStep (1)
  vao.configureAttributes([
    { index: 0, size: 3, type: gl.FLOAT, stride: 32, offset: 0 },
    { index: 1, size: 2, type: gl.FLOAT, stride: 32, offset: 12 },
    { index: 2, size: 2, type: gl.FLOAT, stride: 32, offset: 20 },
    { index: 3, size: 1, type: gl.FLOAT, stride: 32, offset: 28 },
  ], vbo);

  // Lightmap Texture
  let lmTexture: Texture2D | null = null;
  if (data.lightmapAtlas) {
    lmTexture = new Texture2D(gl);
    lmTexture.bind();
    lmTexture.setParameters({
        minFilter: gl.LINEAR,
        magFilter: gl.LINEAR,
        wrapS: gl.CLAMP_TO_EDGE,
        wrapT: gl.CLAMP_TO_EDGE
    });
    lmTexture.upload(data.atlasSize, data.atlasSize, data.lightmapAtlas);
  }

  return {
    vao,
    vbo,
    ibo,
    indexCount: data.indices.length,
    batches: data.batches,
    lightmapAtlas: lmTexture
  };
}
