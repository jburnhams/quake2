import { BspGeometry } from './geometry.js';
import { BspSurfacePipeline } from '../bspPipeline.js';
import { LightStyleManager } from '../lightStyles.js';

export class BspRenderer {
  readonly gl: WebGL2RenderingContext;
  readonly pipeline: BspSurfacePipeline;
  readonly lightStyles: LightStyleManager;

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
    this.pipeline = new BspSurfacePipeline(gl);
    this.lightStyles = new LightStyleManager();
  }

  render(geometry: BspGeometry, modelViewProjection: Float32List, timeSeconds: number, diffuseTextureUnit = 0): void {
    const { gl, pipeline, lightStyles } = this;
    lightStyles.update(timeSeconds);

    // Bind common resources
    geometry.vao.bind();
    if (geometry.lightmapAtlas) {
      geometry.lightmapAtlas.bind(1); // Unit 1 for lightmap
    }

    // Bind shader pipeline (Global Bind)
    pipeline.bind({
      modelViewProjection,
      lightmapSampler: geometry.lightmapAtlas ? 1 : undefined,
      diffuseSampler: diffuseTextureUnit,
      timeSeconds,
      styleValues: lightStyles.getValues() as unknown as number[],
    });

    // Draw batches
    for (const batch of geometry.batches) {
      pipeline.bind({
        modelViewProjection,
        lightmapSampler: geometry.lightmapAtlas ? 1 : undefined,
        diffuseSampler: diffuseTextureUnit,
        timeSeconds,
        surfaceFlags: batch.flags,
        styleValues: lightStyles.getValues() as unknown as number[],
        styleIndices: batch.styleIndices,
        styleLayers: batch.styleLayers
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
