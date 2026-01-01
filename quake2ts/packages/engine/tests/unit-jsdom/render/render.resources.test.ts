import { describe, expect, it } from 'vitest';
import {
  Framebuffer,
  IndexBuffer,
  Texture2D,
  TextureCubeMap,
  VertexArray,
  VertexBuffer,
} from '../../../src/render/resources.js';
import { createMockWebGL2Context } from '@quake2ts/test-utils';

describe('VertexBuffer and IndexBuffer', () => {
  it('binds and uploads data with the requested usage', () => {
    const gl = createMockWebGL2Context();
    const buffer = new VertexBuffer(gl as unknown as WebGL2RenderingContext, gl.STATIC_DRAW);

    const data = new Float32Array([0, 1, 2]);
    buffer.upload(data, gl.STATIC_DRAW);
    expect(gl.bindBuffer).toHaveBeenCalledWith(gl.ARRAY_BUFFER, buffer.buffer);
    expect(gl.bufferData).toHaveBeenCalledWith(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);

    buffer.update(new Uint8Array([9, 9]), 4);
    expect(gl.bufferSubData).toHaveBeenCalledWith(gl.ARRAY_BUFFER, 4, expect.any(Uint8Array));

    buffer.dispose();
    expect(gl.deleteBuffer).toHaveBeenCalledWith(buffer.buffer);
  });

  it('creates element array buffers for indices', () => {
    const gl = createMockWebGL2Context();
    const buffer = new IndexBuffer(gl as unknown as WebGL2RenderingContext, gl.STATIC_DRAW);
    buffer.upload(new Uint16Array([0, 1, 2]), gl.STATIC_DRAW);
    expect(gl.bindBuffer).toHaveBeenCalledWith(gl.ELEMENT_ARRAY_BUFFER, buffer.buffer);
  });
});

describe('VertexArray', () => {
  it('binds attributes and divisors', () => {
    const gl = createMockWebGL2Context();
    const vao = new VertexArray(gl as unknown as WebGL2RenderingContext);
    const vbo = new VertexBuffer(gl as unknown as WebGL2RenderingContext);

    vao.configureAttributes(
      [
        { index: 0, size: 3, type: gl.FLOAT, stride: 24, offset: 0 },
        { index: 1, size: 2, type: gl.FLOAT, stride: 24, offset: 12, divisor: 1 },
      ],
      vbo
    );

    expect(gl.bindVertexArray).toHaveBeenCalledWith(vao.vao);
    expect(gl.enableVertexAttribArray).toHaveBeenCalledWith(0);
    expect(gl.vertexAttribPointer).toHaveBeenCalledWith(0, 3, gl.FLOAT, false, 24, 0);
    expect(gl.vertexAttribDivisor).toHaveBeenCalledWith(1, 1);

    vao.dispose();
    expect(gl.deleteVertexArray).toHaveBeenCalledWith(vao.vao);
  });
});

describe('Texture2D', () => {
  it('binds, sets parameters, and uploads images', () => {
    const gl = createMockWebGL2Context();
    const texture = new Texture2D(gl as unknown as WebGL2RenderingContext);

    texture.setParameters({ wrapS: gl.CLAMP_TO_EDGE ?? 0x812f, wrapT: gl.CLAMP_TO_EDGE ?? 0x812f });
    texture.uploadImage(0, gl.RGBA ?? 0x1908, 64, 64, 0, gl.RGBA ?? 0x1908, gl.UNSIGNED_BYTE ?? 0x1401, null);

    expect(gl.activeTexture).toHaveBeenCalledWith(gl.TEXTURE0);
    expect(gl.texParameteri).toHaveBeenCalled();
    expect(gl.texImage2D).toHaveBeenCalledWith(
      gl.TEXTURE_2D,
      0,
      gl.RGBA ?? 0x1908,
      64,
      64,
      0,
      gl.RGBA ?? 0x1908,
      gl.UNSIGNED_BYTE ?? 0x1401,
      null
    );

    texture.dispose();
    expect(gl.deleteTexture).toHaveBeenCalledWith(texture.texture);
  });
});

describe('TextureCubeMap', () => {
  it('binds, sets parameters, and uploads faces', () => {
    const gl = createMockWebGL2Context();
    const cubemap = new TextureCubeMap(gl as unknown as WebGL2RenderingContext);

    cubemap.setParameters({ minFilter: gl.LINEAR, magFilter: gl.LINEAR });
    cubemap.uploadFace(
      gl.TEXTURE_CUBE_MAP_POSITIVE_X,
      0,
      gl.RGBA ?? 0x1908,
      32,
      32,
      0,
      gl.RGBA ?? 0x1908,
      gl.UNSIGNED_BYTE ?? 0x1401,
      null
    );

    expect(gl.activeTexture).toHaveBeenCalledWith(gl.TEXTURE0);
    expect(gl.bindTexture).toHaveBeenCalledWith(gl.TEXTURE_CUBE_MAP, cubemap.texture);
    expect(gl.texParameteri).toHaveBeenCalledWith(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    expect(gl.texImage2D).toHaveBeenCalledWith(
      gl.TEXTURE_CUBE_MAP_POSITIVE_X,
      0,
      gl.RGBA ?? 0x1908,
      32,
      32,
      0,
      gl.RGBA ?? 0x1908,
      gl.UNSIGNED_BYTE ?? 0x1401,
      null
    );

    cubemap.dispose();
    expect(gl.deleteTexture).toHaveBeenCalledWith(cubemap.texture);
  });
});

describe('Framebuffer', () => {
  it('attaches textures', () => {
    const gl = createMockWebGL2Context();
    const framebuffer = new Framebuffer(gl as unknown as WebGL2RenderingContext);
    const texture = new Texture2D(gl as unknown as WebGL2RenderingContext);

    framebuffer.attachTexture2D(gl.COLOR_ATTACHMENT0, texture);
    expect(gl.bindFramebuffer).toHaveBeenCalledWith(gl.FRAMEBUFFER, framebuffer.framebuffer);
    expect(gl.framebufferTexture2D).toHaveBeenCalledWith(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      texture.target,
      texture.texture,
      0
    );

    framebuffer.dispose();
    expect(gl.deleteFramebuffer).toHaveBeenCalledWith(framebuffer.framebuffer);
  });
});
