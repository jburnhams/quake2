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

    // Draw with raw GL
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

    gl.deleteBuffer(buf);
    gl.deleteProgram(program);
    gl.deleteShader(vs);
    gl.deleteShader(fs);

  `, {
    name: 'texture-wrapping-repeat',
    description: 'Verifies GL_REPEAT texture wrapping by drawing a quad with UVs 0..2',
    width: 256,
    height: 256,
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
    snapshotDir
  });
});
