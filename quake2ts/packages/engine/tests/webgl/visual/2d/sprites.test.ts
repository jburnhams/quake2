import { test } from 'vitest';
import { testWebGLRenderer } from '@quake2ts/test-utils';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const snapshotDir = path.join(__dirname, '..', '..', '__snapshots__');

test('sprite: textured quad - checkerboard', async () => {
  await testWebGLRenderer(`
    // Create checkerboard texture (128x128, 16px checker size, red/black)
    const texWidth = 128;
    const texHeight = 128;
    const checkerSize = 16;
    const texData = new Uint8Array(texWidth * texHeight * 4);

    for (let y = 0; y < texHeight; y++) {
      for (let x = 0; x < texWidth; x++) {
        const checkerX = Math.floor(x / checkerSize);
        const checkerY = Math.floor(y / checkerSize);
        const isRed = (checkerX + checkerY) % 2 === 0;
        const idx = (y * texWidth + x) * 4;
        texData[idx + 0] = isRed ? 255 : 0;  // R
        texData[idx + 1] = 0;                 // G
        texData[idx + 2] = 0;                 // B
        texData[idx + 3] = 255;               // A
      }
    }

    // Create and upload texture
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, texWidth, texHeight, 0, gl.RGBA, gl.UNSIGNED_BYTE, texData);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    // Simple textured quad shader
    const vertexShaderSource = [
      '#version 300 es',
      'in vec2 a_position;',
      'in vec2 a_texCoord;',
      'out vec2 v_texCoord;',
      'void main() {',
      '  gl_Position = vec4(a_position, 0.0, 1.0);',
      '  v_texCoord = a_texCoord;',
      '}'
    ].join('\\n');

    const fragmentShaderSource = [
      '#version 300 es',
      'precision highp float;',
      'in vec2 v_texCoord;',
      'uniform sampler2D u_texture;',
      'out vec4 outColor;',
      'void main() {',
      '  outColor = texture(u_texture, v_texCoord);',
      '}'
    ].join('\\n');

    const vertexShader = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vertexShader, vertexShaderSource);
    gl.compileShader(vertexShader);

    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fragmentShader, fragmentShaderSource);
    gl.compileShader(fragmentShader);

    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    gl.useProgram(program);

    // Quad centered at 64,64 with size 128x128 (NDC coordinates)
    const x = 64, y = 64, w = 128, h = 128;
    const x0 = (x / 256) * 2 - 1;
    const y0 = 1 - (y / 256) * 2;
    const x1 = ((x + w) / 256) * 2 - 1;
    const y1 = 1 - ((y + h) / 256) * 2;

    const vertices = new Float32Array([
      x0, y0, 0, 0,
      x1, y0, 1, 0,
      x0, y1, 0, 1,
      x1, y1, 1, 1,
    ]);

    const vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

    const a_position = gl.getAttribLocation(program, 'a_position');
    const a_texCoord = gl.getAttribLocation(program, 'a_texCoord');

    gl.vertexAttribPointer(a_position, 2, gl.FLOAT, false, 16, 0);
    gl.enableVertexAttribArray(a_position);
    gl.vertexAttribPointer(a_texCoord, 2, gl.FLOAT, false, 16, 8);
    gl.enableVertexAttribArray(a_texCoord);

    // Clear to black and render
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  `, {
    name: '2d-sprite-checkerboard',
    description: 'Red/black checkerboard sprite centered on black background',
    width: 256,
    height: 256,
    updateBaseline: process.env.UPDATE_VISUAL === '1',
    snapshotDir
  });
}, { timeout: 30000 });

test('sprite: simple rendering', async () => {
  await testWebGLRenderer(`
    // Create simple 32x32 green/blue checkerboard texture
    const texWidth = 32;
    const texHeight = 32;
    const checkerSize = 8;
    const texData = new Uint8Array(texWidth * texHeight * 4);

    for (let y = 0; y < texHeight; y++) {
      for (let x = 0; x < texWidth; x++) {
        const checkerX = Math.floor(x / checkerSize);
        const checkerY = Math.floor(y / checkerSize);
        const isGreen = (checkerX + checkerY) % 2 === 0;
        const idx = (y * texWidth + x) * 4;
        texData[idx + 0] = 0;
        texData[idx + 1] = isGreen ? 255 : 0;  // G
        texData[idx + 2] = isGreen ? 0 : 255;  // B
        texData[idx + 3] = 255;
      }
    }

    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, texWidth, texHeight, 0, gl.RGBA, gl.UNSIGNED_BYTE, texData);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

    const vertexShaderSource = [
      '#version 300 es',
      'in vec2 a_position;',
      'in vec2 a_texCoord;',
      'out vec2 v_texCoord;',
      'void main() {',
      '  gl_Position = vec4(a_position, 0.0, 1.0);',
      '  v_texCoord = a_texCoord;',
      '}'
    ].join('\\n');

    const fragmentShaderSource = [
      '#version 300 es',
      'precision highp float;',
      'in vec2 v_texCoord;',
      'uniform sampler2D u_texture;',
      'out vec4 outColor;',
      'void main() {',
      '  outColor = texture(u_texture, v_texCoord);',
      '}'
    ].join('\\n');

    const vertexShader = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vertexShader, vertexShaderSource);
    gl.compileShader(vertexShader);

    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fragmentShader, fragmentShaderSource);
    gl.compileShader(fragmentShader);

    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    gl.useProgram(program);

    // Centered at 112,112 with size 32x32
    const x = 112, y = 112, w = 32, h = 32;
    const x0 = (x / 256) * 2 - 1;
    const y0 = 1 - (y / 256) * 2;
    const x1 = ((x + w) / 256) * 2 - 1;
    const y1 = 1 - ((y + h) / 256) * 2;

    const vertices = new Float32Array([
      x0, y0, 0, 0,
      x1, y0, 1, 0,
      x0, y1, 0, 1,
      x1, y1, 1, 1,
    ]);

    const vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

    const a_position = gl.getAttribLocation(program, 'a_position');
    const a_texCoord = gl.getAttribLocation(program, 'a_texCoord');

    gl.vertexAttribPointer(a_position, 2, gl.FLOAT, false, 16, 0);
    gl.enableVertexAttribArray(a_position);
    gl.vertexAttribPointer(a_texCoord, 2, gl.FLOAT, false, 16, 8);
    gl.enableVertexAttribArray(a_texCoord);

    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  `, {
    name: '2d-sprite-simple',
    description: 'Simple 32x32 green/blue checkerboard sprite',
    width: 256,
    height: 256,
    updateBaseline: process.env.UPDATE_VISUAL === '1',
    snapshotDir
  });
}, { timeout: 30000 });

test('sprite: alpha blending', async () => {
  await testWebGLRenderer(`
    // Semi-transparent blue texture
    const texWidth = 128;
    const texHeight = 128;
    const texData = new Uint8Array(texWidth * texHeight * 4);

    for (let i = 0; i < texWidth * texHeight; i++) {
      texData[i * 4 + 0] = 0;    // R
      texData[i * 4 + 1] = 0;    // G
      texData[i * 4 + 2] = 255;  // B
      texData[i * 4 + 3] = 128;  // A (50%)
    }

    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, texWidth, texHeight, 0, gl.RGBA, gl.UNSIGNED_BYTE, texData);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

    const vertexShaderSource = [
      '#version 300 es',
      'in vec2 a_position;',
      'in vec2 a_texCoord;',
      'out vec2 v_texCoord;',
      'void main() {',
      '  gl_Position = vec4(a_position, 0.0, 1.0);',
      '  v_texCoord = a_texCoord;',
      '}'
    ].join('\\n');

    const fragmentShaderSource = [
      '#version 300 es',
      'precision highp float;',
      'in vec2 v_texCoord;',
      'uniform sampler2D u_texture;',
      'out vec4 outColor;',
      'void main() {',
      '  outColor = texture(u_texture, v_texCoord);',
      '}'
    ].join('\\n');

    const vertexShader = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vertexShader, vertexShaderSource);
    gl.compileShader(vertexShader);

    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fragmentShader, fragmentShaderSource);
    gl.compileShader(fragmentShader);

    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    gl.useProgram(program);

    const x = 64, y = 64, w = 128, h = 128;
    const x0 = (x / 256) * 2 - 1;
    const y0 = 1 - (y / 256) * 2;
    const x1 = ((x + w) / 256) * 2 - 1;
    const y1 = 1 - ((y + h) / 256) * 2;

    const vertices = new Float32Array([
      x0, y0, 0, 0,
      x1, y0, 1, 0,
      x0, y1, 0, 1,
      x1, y1, 1, 1,
    ]);

    const vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

    const a_position = gl.getAttribLocation(program, 'a_position');
    const a_texCoord = gl.getAttribLocation(program, 'a_texCoord');

    gl.vertexAttribPointer(a_position, 2, gl.FLOAT, false, 16, 0);
    gl.enableVertexAttribArray(a_position);
    gl.vertexAttribPointer(a_texCoord, 2, gl.FLOAT, false, 16, 8);
    gl.enableVertexAttribArray(a_texCoord);

    // Enable blending
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    // Red background
    gl.clearColor(1, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // Draw semi-transparent blue sprite
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  `, {
    name: '2d-sprite-alpha',
    description: 'Semi-transparent blue sprite over red background',
    width: 256,
    height: 256,
    updateBaseline: process.env.UPDATE_VISUAL === '1',
    snapshotDir
  });
}, { timeout: 30000 });

test('sprite: batch rendering', async () => {
  await testWebGLRenderer(`
    // Solid red texture
    const texWidth = 64;
    const texHeight = 64;
    const redTexData = new Uint8Array(texWidth * texHeight * 4);
    for (let i = 0; i < texWidth * texHeight; i++) {
      redTexData[i * 4 + 0] = 255;
      redTexData[i * 4 + 1] = 0;
      redTexData[i * 4 + 2] = 0;
      redTexData[i * 4 + 3] = 255;
    }

    const redTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, redTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, texWidth, texHeight, 0, gl.RGBA, gl.UNSIGNED_BYTE, redTexData);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

    // Solid green texture
    const greenTexData = new Uint8Array(texWidth * texHeight * 4);
    for (let i = 0; i < texWidth * texHeight; i++) {
      greenTexData[i * 4 + 0] = 0;
      greenTexData[i * 4 + 1] = 255;
      greenTexData[i * 4 + 2] = 0;
      greenTexData[i * 4 + 3] = 255;
    }

    const greenTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, greenTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, texWidth, texHeight, 0, gl.RGBA, gl.UNSIGNED_BYTE, greenTexData);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

    // Setup shader
    const vertexShaderSource = [
      '#version 300 es',
      'in vec2 a_position;',
      'in vec2 a_texCoord;',
      'out vec2 v_texCoord;',
      'void main() {',
      '  gl_Position = vec4(a_position, 0.0, 1.0);',
      '  v_texCoord = a_texCoord;',
      '}'
    ].join('\\n');

    const fragmentShaderSource = [
      '#version 300 es',
      'precision highp float;',
      'in vec2 v_texCoord;',
      'uniform sampler2D u_texture;',
      'out vec4 outColor;',
      'void main() {',
      '  outColor = texture(u_texture, v_texCoord);',
      '}'
    ].join('\\n');

    const vertexShader = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vertexShader, vertexShaderSource);
    gl.compileShader(vertexShader);

    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fragmentShader, fragmentShaderSource);
    gl.compileShader(fragmentShader);

    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    gl.useProgram(program);

    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // Draw red sprite at 50,50
    gl.bindTexture(gl.TEXTURE_2D, redTexture);

    let x = 50, y = 50, w = 64, h = 64;
    let x0 = (x / 256) * 2 - 1;
    let y0 = 1 - (y / 256) * 2;
    let x1 = ((x + w) / 256) * 2 - 1;
    let y1 = 1 - ((y + h) / 256) * 2;

    let vertices = new Float32Array([
      x0, y0, 0, 0,
      x1, y0, 1, 0,
      x0, y1, 0, 1,
      x1, y1, 1, 1,
    ]);

    const vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

    const a_position = gl.getAttribLocation(program, 'a_position');
    const a_texCoord = gl.getAttribLocation(program, 'a_texCoord');

    gl.vertexAttribPointer(a_position, 2, gl.FLOAT, false, 16, 0);
    gl.enableVertexAttribArray(a_position);
    gl.vertexAttribPointer(a_texCoord, 2, gl.FLOAT, false, 16, 8);
    gl.enableVertexAttribArray(a_texCoord);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    // Draw green sprite at 80,80 (overlapping)
    gl.bindTexture(gl.TEXTURE_2D, greenTexture);

    x = 80; y = 80;
    x0 = (x / 256) * 2 - 1;
    y0 = 1 - (y / 256) * 2;
    x1 = ((x + w) / 256) * 2 - 1;
    y1 = 1 - ((y + h) / 256) * 2;

    vertices = new Float32Array([
      x0, y0, 0, 0,
      x1, y0, 1, 0,
      x0, y1, 0, 1,
      x1, y1, 1, 1,
    ]);

    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  `, {
    name: '2d-sprite-batch',
    description: 'Overlapping sprites (Red then Green)',
    width: 256,
    height: 256,
    updateBaseline: process.env.UPDATE_VISUAL === '1',
    snapshotDir
  });
}, { timeout: 30000 });
