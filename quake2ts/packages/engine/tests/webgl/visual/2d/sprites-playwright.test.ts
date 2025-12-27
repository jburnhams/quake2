import { test } from 'vitest';
import {
  createWebGLPlaywrightSetup,
  expectWebGLPlaywrightSnapshot,
} from '@quake2ts/test-utils';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const snapshotDir = path.join(__dirname, '..', '..', '__snapshots__');

// Helper to create checkerboard texture data in browser
const createCheckerboardInBrowser = `
  function createCheckerboard(width, height, checkerSize, color1, color2) {
    const data = new Uint8Array(width * height * 4);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const checkerX = Math.floor(x / checkerSize);
        const checkerY = Math.floor(y / checkerSize);
        const isColor1 = (checkerX + checkerY) % 2 === 0;
        const color = isColor1 ? color1 : color2;

        const idx = (y * width + x) * 4;
        data[idx + 0] = Math.floor(color[0] * 255);
        data[idx + 1] = Math.floor(color[1] * 255);
        data[idx + 2] = Math.floor(color[2] * 255);
        data[idx + 3] = Math.floor(color[3] * 255);
      }
    }

    return data;
  }
`;

test('sprite: textured quad - checkerboard', async () => {
  const setup = await createWebGLPlaywrightSetup({ width: 256, height: 256 });

  try {
    await expectWebGLPlaywrightSnapshot(
      setup,
      async (page) => {
        await page.evaluate((helpers) => {
          // Inject helper
          eval(helpers.createCheckerboard);

          const canvas = document.getElementById('glCanvas') as HTMLCanvasElement;
          const gl = canvas.getContext('webgl2')!;

          // Create checkerboard texture
          const texData = createCheckerboard(128, 128, 16, [1, 0, 0, 1], [0, 0, 0, 1]);

          // Create and upload texture
          const texture = gl.createTexture();
          gl.bindTexture(gl.TEXTURE_2D, texture);
          gl.texImage2D(
            gl.TEXTURE_2D,
            0,
            gl.RGBA,
            128,
            128,
            0,
            gl.RGBA,
            gl.UNSIGNED_BYTE,
            texData
          );
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

          // Create simple shader program
          const vertexShaderSource = '#version 300 es\\n' +
            'precision highp float;\\n' +
            'layout(location = 0) in vec2 aPosition;\\n' +
            'layout(location = 1) in vec2 aTexCoord;\\n' +
            'out vec2 vTexCoord;\\n' +
            'void main() {\\n' +
            '  gl_Position = vec4(aPosition, 0.0, 1.0);\\n' +
            '  vTexCoord = aTexCoord;\\n' +
            '}';

          const fragmentShaderSource = '#version 300 es\\n' +
            'precision highp float;\\n' +
            'in vec2 vTexCoord;\\n' +
            'out vec4 fragColor;\\n' +
            'uniform sampler2D uTexture;\\n' +
            'void main() {\\n' +
            '  fragColor = texture(uTexture, vTexCoord);\\n' +
            '}';

          const vertexShader = gl.createShader(gl.VERTEX_SHADER)!;
          gl.shaderSource(vertexShader, vertexShaderSource);
          gl.compileShader(vertexShader);

          const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER)!;
          gl.shaderSource(fragmentShader, fragmentShaderSource);
          gl.compileShader(fragmentShader);

          const program = gl.createProgram()!;
          gl.attachShader(program, vertexShader);
          gl.attachShader(program, fragmentShader);
          gl.linkProgram(program);
          gl.useProgram(program);

          // Create quad geometry (centered at 64, 64 with size 128x128)
          // Convert pixel coordinates to NDC
          const x = 64;
          const y = 64;
          const w = 128;
          const h = 128;

          const left = (x / 256) * 2 - 1;
          const right = ((x + w) / 256) * 2 - 1;
          const top = 1 - (y / 256) * 2;
          const bottom = 1 - ((y + h) / 256) * 2;

          const vertices = new Float32Array([
            // Position (x, y)    // TexCoord (u, v)
            left, top,            0, 0,
            right, top,           1, 0,
            left, bottom,         0, 1,
            right, bottom,        1, 1,
          ]);

          const vbo = gl.createBuffer();
          gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
          gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

          gl.enableVertexAttribArray(0);
          gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 16, 0);
          gl.enableVertexAttribArray(1);
          gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 16, 8);

          // Clear and render
          gl.clearColor(0, 0, 0, 1);
          gl.clear(gl.COLOR_BUFFER_BIT);

          gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
          gl.flush();
        }, { createCheckerboard: createCheckerboardInBrowser });
      },
      {
        name: '2d-sprite-checkerboard',
        description: 'Red/black checkerboard sprite centered on black background',
        updateBaseline: process.env.UPDATE_VISUAL === '1',
        snapshotDir
      }
    );
  } finally {
    await setup.cleanup();
  }
}, { timeout: 30000 });

test('sprite: basic rendering', async () => {
  const setup = await createWebGLPlaywrightSetup({ width: 256, height: 256 });

  try {
    await expectWebGLPlaywrightSnapshot(
      setup,
      async (page) => {
        await page.evaluate((helpers) => {
          eval(helpers.createCheckerboard);

          const canvas = document.getElementById('glCanvas') as HTMLCanvasElement;
          const gl = canvas.getContext('webgl2')!;

          // Create small 32x32 texture (Green/Blue)
          const texData = createCheckerboard(32, 32, 8, [0, 1, 0, 1], [0, 0, 1, 1]);

          const texture = gl.createTexture();
          gl.bindTexture(gl.TEXTURE_2D, texture);
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 32, 32, 0, gl.RGBA, gl.UNSIGNED_BYTE, texData);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

          // Shader program
          const vertexShaderSource = '#version 300 es\\n' +
            'precision highp float;\\n' +
            'layout(location = 0) in vec2 aPosition;\\n' +
            'layout(location = 1) in vec2 aTexCoord;\\n' +
            'out vec2 vTexCoord;\\n' +
            'void main() {\\n' +
            '  gl_Position = vec4(aPosition, 0.0, 1.0);\\n' +
            '  vTexCoord = aTexCoord;\\n' +
            '}';

          const fragmentShaderSource = '#version 300 es\\n' +
            'precision highp float;\\n' +
            'in vec2 vTexCoord;\\n' +
            'out vec4 fragColor;\\n' +
            'uniform sampler2D uTexture;\\n' +
            'void main() {\\n' +
            '  fragColor = texture(uTexture, vTexCoord);\\n' +
            '}';

          const vertexShader = gl.createShader(gl.VERTEX_SHADER)!;
          gl.shaderSource(vertexShader, vertexShaderSource);
          gl.compileShader(vertexShader);

          const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER)!;
          gl.shaderSource(fragmentShader, fragmentShaderSource);
          gl.compileShader(fragmentShader);

          const program = gl.createProgram()!;
          gl.attachShader(program, vertexShader);
          gl.attachShader(program, fragmentShader);
          gl.linkProgram(program);
          gl.useProgram(program);

          // Centered at 112, 112 with size 32x32
          const x = 112, y = 112, w = 32, h = 32;
          const left = (x / 256) * 2 - 1;
          const right = ((x + w) / 256) * 2 - 1;
          const top = 1 - (y / 256) * 2;
          const bottom = 1 - ((y + h) / 256) * 2;

          const vertices = new Float32Array([
            left, top, 0, 0,
            right, top, 1, 0,
            left, bottom, 0, 1,
            right, bottom, 1, 1,
          ]);

          const vbo = gl.createBuffer();
          gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
          gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
          gl.enableVertexAttribArray(0);
          gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 16, 0);
          gl.enableVertexAttribArray(1);
          gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 16, 8);

          gl.clearColor(0, 0, 0, 1);
          gl.clear(gl.COLOR_BUFFER_BIT);
          gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
          gl.flush();
        }, { createCheckerboard: createCheckerboardInBrowser });
      },
      {
        name: '2d-sprite-simple',
        description: 'Simple 32x32 sprite',
        updateBaseline: process.env.UPDATE_VISUAL === '1',
        snapshotDir
      }
    );
  } finally {
    await setup.cleanup();
  }
}, { timeout: 30000 });
