/**
 * WebGL upload of a `PreparedWorld` (see prepareWorld.ts): the geometry, lightmap atlases and
 * every texture the map uses, returned as the `WorldRenderState` that `renderFrame` takes.
 * The WebGPU backend has its own `uploadWorld` with the same input.
 */
import type { PreparedTexture } from '../assets/texture.js';
import { uploadBspGeometry } from './bsp.js';
import type { WorldRenderState } from './frame.js';
import type { PreparedWorld } from './prepareWorld.js';
import { Texture2D } from './resources.js';

/** Uploads every mip level with repeat wrapping and trilinear filtering, as surfaces tile. */
export function uploadWorldTexture(gl: WebGL2RenderingContext, prepared: PreparedTexture): Texture2D {
  const texture = new Texture2D(gl);
  texture.setParameters({
    wrapS: gl.REPEAT,
    wrapT: gl.REPEAT,
    minFilter: prepared.levels.length > 1 ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR,
    magFilter: gl.LINEAR,
  });
  for (const level of prepared.levels) {
    texture.uploadImage(level.level, gl.RGBA, level.width, level.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, level.rgba);
  }
  if (prepared.levels.length > 1) {
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAX_LEVEL, prepared.levels.length - 1);
  }
  return texture;
}

export function uploadWorldWebGL(gl: WebGL2RenderingContext, world: PreparedWorld): WorldRenderState {
  const { surfaces, lightmaps } = uploadBspGeometry(gl, world.geometry);
  const textures = new Map<string, Texture2D>();
  for (const [name, prepared] of world.textures) {
    textures.set(name, uploadWorldTexture(gl, prepared));
  }
  return { map: world.map, surfaces, lightmaps, textures, lightStyles: world.lightStyles };
}
