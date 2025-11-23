import { BspGeometry } from './geometry.js';
import { BspSurfacePipeline } from '../bspPipeline.js';

export class BspRenderer {
  readonly gl: WebGL2RenderingContext;
  readonly pipeline: BspSurfacePipeline;

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
    this.pipeline = new BspSurfacePipeline(gl);
  }

  render(geometry: BspGeometry, modelViewProjection: Float32List, timeSeconds: number, diffuseTextureUnit = 0): void {
    const { gl, pipeline } = this;

    // Bind common resources
    geometry.vao.bind();
    if (geometry.lightmapAtlas) {
      geometry.lightmapAtlas.bind(1); // Unit 1 for lightmap
    }

    // Bind shader pipeline
    pipeline.bind({
      modelViewProjection,
      lightmapSampler: geometry.lightmapAtlas ? 1 : undefined,
      diffuseSampler: diffuseTextureUnit,
      timeSeconds
    });

    // Draw batches
    for (const batch of geometry.batches) {
      // Setup state based on batch flags/texture
      // For now, we assume diffuse texture is bound externally or we need a texture manager to bind it here.
      // The current interface assumes 'diffuseTextureUnit' is already set up.
      // But we have batch.textureName. We should ideally ask a texture manager to bind it.
      // For this simplified implementation, we'll assume the caller handles texture binding
      // OR we just verify the draw calls.

      // We need to re-bind pipeline with specific surface flags for this batch if they differ?
      // BspSurfacePipeline.bind() sets uniforms.
      // We might want a lightweight 'updateState' or just call bind again.

      pipeline.bind({
        modelViewProjection,
        lightmapSampler: geometry.lightmapAtlas ? 1 : undefined,
        diffuseSampler: diffuseTextureUnit,
        timeSeconds,
        surfaceFlags: batch.flags
      });

      // Draw elements
      // offset is in elements (indices), indices are Uint32 (4 bytes) or Uint16 (2 bytes).
      // buildBspGeometry used Uint32Array, so gl.UNSIGNED_INT and offset * 4.

      gl.drawElements(gl.TRIANGLES, batch.count, gl.UNSIGNED_INT, batch.offset * 4);
    }
  }

  dispose(): void {
    this.pipeline.dispose();
  }
}
