import { test } from 'vitest';
import { testWebGLRenderer } from '@quake2ts/test-utils';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const snapshotDir = path.join(__dirname, '..', '..', '__snapshots__');

test('Texture Wrapping: Repeat', { timeout: 30000 }, async () => {
  await testWebGLRenderer(`
    gl.clearColor(0.2, 0.2, 0.2, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // Create a 4x4 texture with a distinct pattern
    // Top-left: Red, Top-right: Green
    // Bot-left: Blue, Bot-right: Yellow
    const tex = new Quake2Engine.Texture2D(gl);
    const size = 4;
    const data = new Uint8Array(size * size * 4);

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const i = (y * size + x) * 4;
        if (x < size/2 && y < size/2) { // Top-left Red
            data[i] = 255; data[i+1] = 0; data[i+2] = 0; data[i+3] = 255;
        } else if (x >= size/2 && y < size/2) { // Top-right Green
            data[i] = 0; data[i+1] = 255; data[i+2] = 0; data[i+3] = 255;
        } else if (x < size/2 && y >= size/2) { // Bot-left Blue
            data[i] = 0; data[i+1] = 0; data[i+2] = 255; data[i+3] = 255;
        } else { // Bot-right Yellow
            data[i] = 255; data[i+1] = 255; data[i+2] = 0; data[i+3] = 255;
        }
      }
    }

    tex.upload(size, size, data);

    // Set to REPEAT
    tex.setParameters({
      wrapS: gl.REPEAT,
      wrapT: gl.REPEAT,
      minFilter: gl.NEAREST,
      magFilter: gl.NEAREST
    });

    // Draw with UVs from 0 to 2.0 (should show the texture tiled 2x2 times)
    renderer.begin2D();

    // Custom draw to control UVs
    // We can't use renderer.drawPic easily for custom UVs > 1 without hacking.
    // renderer.drawPic implementation: spriteRenderer.draw(x, y, w, h, 0, 0, 1, 1, color)
    // We need to call spriteRenderer.draw(x, y, w, h, 0, 0, 2, 2, color)
    // Use the same hack as filtering test: mock the pic object? No, mock object doesn't control UVs passed to draw.
    // Access spriteRenderer directly? It's private/protected in Renderer implementation.
    // However, createRenderer returns an object that *is* the renderer.
    // Let's check if 'spriteRenderer' is exposed on the returned object?
    // In 'renderer.ts': return { ..., drawPic, ... }; It does NOT expose spriteRenderer.

    // BUT! renderer.drawPic implementation:
    /*
      const drawPic = (x: number, y: number, pic: Pic, color?: [number, number, number, number]) => {
        (pic as Texture2D).bind(0);
        spriteRenderer.draw(x, y, pic.width, pic.height, 0, 0, 1, 1, color);
      };
    */
    // Wait, renderer.drawChar uses UVs.
    /*
      const drawChar = (..., u0, v0, u1, v1, ...) => ...
    */
    // But drawChar uses 'font' texture.

    // Let's use 'drawTexture' from the sprite renderer directly if we can access it?
    // We cannot.

    // Workaround: We can use 'drawString' if we register our texture as 'conchars'.
    // "if (name.includes('conchars')) { font = texture; }"
    // So if we register a texture named "conchars", it becomes the font.
    // Then we can use drawString or drawChar.

    // But drawChar calculates UVs based on character index. We want 0..2.

    // Alternative: Use a custom shader or raw GL calls?
    // We have 'gl' context. We can just draw a quad ourselves using the texture.
    // The test helper gives us 'renderer' and 'gl'.
    // We can assume the renderer has set up some state, but we can override it.

    // Let's just write a raw GL draw for this test. It's testing the texture parameters, not the renderer's drawPic method specifically.
    // We verify that the Texture2D abstraction correctly sets the GL parameters.

    const program = gl.createProgram();
    const vs = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vs,
      "#version 300 es\\n" +
      "in vec2 position; in vec2 uv; out vec2 vUv; void main() { gl_Position = vec4(position, 0, 1); vUv = uv; }"
    );
    gl.compileShader(vs);
    const fs = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fs,
      "#version 300 es\\n" +
      "precision mediump float; uniform sampler2D uTex; in vec2 vUv; out vec4 color; void main() { color = texture(uTex, vUv); }"
    );
    gl.compileShader(fs);
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    gl.useProgram(program);

    // Quad covering the screen (-1 to 1), UVs 0 to 2
    const vertData = new Float32Array([
      -0.8, -0.8,  0.0, 2.0, // Top-Left (GL coords y is up) -> wait.
                             // Let's map standard GL clip space.
                             // -1,-1 is bottom left.
                             // We want to verify tiling.
      -0.8,  0.8,  0.0, 0.0, // Top-Left
       0.8, -0.8,  2.0, 2.0, // Bottom-Right
       0.8,  0.8,  2.0, 0.0  // Top-Right
    ]);
    // Standard triangle strip: TL, BL, TR, BR ?
    // No.
    // TL (-0.8, 0.8), BL (-0.8, -0.8), TR (0.8, 0.8), BR (0.8, -0.8)
    const verts = new Float32Array([
       -0.8, -0.8, 0.0, 2.0, // BL, UV(0,2)
        0.8, -0.8, 2.0, 2.0, // BR, UV(2,2)
       -0.8,  0.8, 0.0, 0.0, // TL, UV(0,0)
        0.8,  0.8, 2.0, 0.0  // TR, UV(2,0)
    ]);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);

    const posLoc = gl.getAttribLocation(program, "position");
    const uvLoc = gl.getAttribLocation(program, "uv");

    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 16, 0);
    gl.enableVertexAttribArray(uvLoc);
    gl.vertexAttribPointer(uvLoc, 2, gl.FLOAT, false, 16, 8);

    tex.bind(0);
    gl.uniform1i(gl.getUniformLocation(program, "uTex"), 0);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    // Clean up to not mess other tests if they reused context (they don't usually)
    gl.deleteBuffer(buf);
    gl.deleteProgram(program);
    gl.deleteShader(vs);
    gl.deleteShader(fs);

  `, {
    name: 'texture-wrapping-repeat',
    description: 'Verifies GL_REPEAT texture wrapping by drawing a quad with UVs 0..2',
    width: 256,
    height: 256,
    updateBaseline: process.env.UPDATE_VISUAL === '1',
    snapshotDir
  });
});

test('Texture Wrapping: Clamp', { timeout: 30000 }, async () => {
  await testWebGLRenderer(`
    gl.clearColor(0.2, 0.2, 0.2, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    const tex = new Quake2Engine.Texture2D(gl);
    const size = 4;
    const data = new Uint8Array(size * size * 4);
    // Simple gradient or pattern
    for(let i=0; i<data.length; i+=4) {
        data[i] = 255;   // Red
        data[i+1] = 0;
        data[i+2] = 0;
        data[i+3] = 255;
    }
    // Make center distinct? No, let's just use the red texture.
    // If we clamp, the edge pixels (Red) should extend.
    // If we repeat, we might see boundary if we had one.
    // Let's use the same 4-quad pattern as above.
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const i = (y * size + x) * 4;
        if (x < size/2 && y < size/2) { data[i]=255; data[i+1]=0; data[i+2]=0; } // TL Red
        else if (x >= size/2 && y < size/2) { data[i]=0; data[i+1]=255; data[i+2]=0; } // TR Green
        else if (x < size/2 && y >= size/2) { data[i]=0; data[i+1]=0; data[i+2]=255; } // BL Blue
        else { data[i]=255; data[i+1]=255; data[i+2]=0; } // BR Yellow
        data[i+3] = 255;
      }
    }

    tex.upload(size, size, data);

    tex.setParameters({
      wrapS: gl.CLAMP_TO_EDGE,
      wrapT: gl.CLAMP_TO_EDGE,
      minFilter: gl.NEAREST,
      magFilter: gl.NEAREST
    });

    // Draw with raw GL
    const program = gl.createProgram();
    const vs = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vs, "#version 300 es\\nin vec2 position; in vec2 uv; out vec2 vUv; void main() { gl_Position = vec4(position, 0, 1); vUv = uv; }");
    gl.compileShader(vs);
    const fs = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fs, "#version 300 es\\nprecision mediump float; uniform sampler2D uTex; in vec2 vUv; out vec4 color; void main() { color = texture(uTex, vUv); }");
    gl.compileShader(fs);
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    gl.useProgram(program);

    // UVs -0.5 to 1.5. Center 0..1 should be normal. Outside should be clamped.
    // Since texture is 2x2 blocks of color.
    // 0..1 is R,G / B,Y.
    // >1 should extend G and Y.
    // <0 should extend R and B.

    const verts = new Float32Array([
       -0.8, -0.8, -0.5, 1.5, // BL
        0.8, -0.8,  1.5, 1.5, // BR
       -0.8,  0.8, -0.5, -0.5, // TL
        0.8,  0.8,  1.5, -0.5  // TR
    ]);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);

    const posLoc = gl.getAttribLocation(program, "position");
    const uvLoc = gl.getAttribLocation(program, "uv");
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 16, 0);
    gl.enableVertexAttribArray(uvLoc);
    gl.vertexAttribPointer(uvLoc, 2, gl.FLOAT, false, 16, 8);

    tex.bind(0);
    gl.uniform1i(gl.getUniformLocation(program, "uTex"), 0);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    gl.deleteBuffer(buf);
    gl.deleteProgram(program);
    gl.deleteShader(vs);
    gl.deleteShader(fs);

  `, {
    name: 'texture-wrapping-clamp',
    description: 'Verifies GL_CLAMP_TO_EDGE texture wrapping by drawing a quad with UVs outside 0..1',
    width: 256,
    height: 256,
    updateBaseline: process.env.UPDATE_VISUAL === '1',
    snapshotDir
  });
});

test('Texture Wrapping: NPOT', { timeout: 30000 }, async () => {
  await testWebGLRenderer(`
    gl.clearColor(0.2, 0.2, 0.2, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // Non-power-of-two size: 53x27
    const width = 53;
    const height = 27;
    const tex = new Quake2Engine.Texture2D(gl);
    const data = new Uint8Array(width * height * 4);

    // Fill with a diagonal stripe pattern
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const i = (y * width + x) * 4;
            const isStripe = (x + y) % 8 < 4;
            if (isStripe) {
                data[i] = 255; data[i+1] = 255; data[i+2] = 0; data[i+3] = 255; // Yellow
            } else {
                data[i] = 0; data[i+1] = 0; data[i+2] = 255; data[i+3] = 255; // Blue
            }
        }
    }

    tex.upload(width, height, data);

    tex.setParameters({
      minFilter: gl.NEAREST,
      magFilter: gl.NEAREST
    });

    renderer.begin2D();
    renderer.drawPic(10, 10, tex);
    renderer.end2D();

  `, {
    name: 'texture-wrapping-npot',
    description: 'Verifies support for Non-Power-Of-Two textures (WebGL 2 feature)',
    width: 128,
    height: 128,
    updateBaseline: process.env.UPDATE_VISUAL === '1',
    snapshotDir
  });
});
