import { test } from 'vitest';
import { testWebGLRenderer } from '@quake2ts/test-utils';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const snapshotDir = path.join(__dirname, '..', '..', '__snapshots__');

test('ui: filled rectangle - solid color', async () => {
  await testWebGLRenderer(`
    const vertexShaderSource = [
      '#version 300 es',
      'in vec2 a_position;',
      'void main() {',
      '  gl_Position = vec4(a_position, 0.0, 1.0);',
      '}'
    ].join('\\n');

    const fragmentShaderSource = [
      '#version 300 es',
      'precision highp float;',
      'uniform vec4 u_color;',
      'out vec4 outColor;',
      'void main() {',
      '  outColor = u_color;',
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

    // Blue rectangle at 64,64 with size 128x128
    const x = 64, y = 64, w = 128, h = 128;
    const x0 = (x / 256) * 2 - 1;
    const y0 = 1 - (y / 256) * 2;
    const x1 = ((x + w) / 256) * 2 - 1;
    const y1 = 1 - ((y + h) / 256) * 2;

    const vertices = new Float32Array([
      x0, y0,
      x1, y0,
      x0, y1,
      x1, y1,
    ]);

    const vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

    const a_position = gl.getAttribLocation(program, 'a_position');
    gl.vertexAttribPointer(a_position, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(a_position);

    const u_color = gl.getUniformLocation(program, 'u_color');

    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // Draw blue rectangle
    gl.uniform4f(u_color, 0, 0, 1, 1);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  `, {
    name: '2d-ui-rect-solid',
    description: 'Solid blue rectangle on black',
    width: 256,
    height: 256,
    updateBaseline: process.env.UPDATE_VISUAL === '1',
    snapshotDir
  });
});

test('ui: multiple rectangles - overlapping', { timeout: 30000 }, async () => {
  await testWebGLRenderer(`
    const vertexShaderSource = [
      '#version 300 es',
      'in vec2 a_position;',
      'void main() {',
      '  gl_Position = vec4(a_position, 0.0, 1.0);',
      '}'
    ].join('\\n');

    const fragmentShaderSource = [
      '#version 300 es',
      'precision highp float;',
      'uniform vec4 u_color;',
      'out vec4 outColor;',
      'void main() {',
      '  outColor = u_color;',
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

    const vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);

    const a_position = gl.getAttribLocation(program, 'a_position');
    gl.vertexAttribPointer(a_position, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(a_position);

    const u_color = gl.getUniformLocation(program, 'u_color');

    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // Red rectangle at 40,40
    let x = 40, y = 40, w = 100, h = 100;
    let x0 = (x / 256) * 2 - 1;
    let y0 = 1 - (y / 256) * 2;
    let x1 = ((x + w) / 256) * 2 - 1;
    let y1 = 1 - ((y + h) / 256) * 2;

    let vertices = new Float32Array([x0, y0, x1, y0, x0, y1, x1, y1]);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
    gl.uniform4f(u_color, 1, 0, 0, 1);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    // Green rectangle at 80,80
    x = 80; y = 80;
    x0 = (x / 256) * 2 - 1;
    y0 = 1 - (y / 256) * 2;
    x1 = ((x + w) / 256) * 2 - 1;
    y1 = 1 - ((y + h) / 256) * 2;

    vertices = new Float32Array([x0, y0, x1, y0, x0, y1, x1, y1]);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
    gl.uniform4f(u_color, 0, 1, 0, 1);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    // Blue rectangle at 120,120
    x = 120; y = 120;
    x0 = (x / 256) * 2 - 1;
    y0 = 1 - (y / 256) * 2;
    x1 = ((x + w) / 256) * 2 - 1;
    y1 = 1 - ((y + h) / 256) * 2;

    vertices = new Float32Array([x0, y0, x1, y0, x0, y1, x1, y1]);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
    gl.uniform4f(u_color, 0, 0, 1, 1);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  `, {
    name: '2d-ui-rect-overlap',
    description: 'Three overlapping rectangles (Red, Green, Blue)',
    width: 256,
    height: 256,
    updateBaseline: process.env.UPDATE_VISUAL === '1',
    snapshotDir
  });
});

test('ui: rectangle with transparency', { timeout: 30000 }, async () => {
  await testWebGLRenderer(`
    const vertexShaderSource = [
      '#version 300 es',
      'in vec2 a_position;',
      'void main() {',
      '  gl_Position = vec4(a_position, 0.0, 1.0);',
      '}'
    ].join('\\n');

    const fragmentShaderSource = [
      '#version 300 es',
      'precision highp float;',
      'uniform vec4 u_color;',
      'out vec4 outColor;',
      'void main() {',
      '  outColor = u_color;',
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

    const vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);

    const a_position = gl.getAttribLocation(program, 'a_position');
    gl.vertexAttribPointer(a_position, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(a_position);

    const u_color = gl.getUniformLocation(program, 'u_color');

    // Enable blending
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    gl.clearColor(0.2, 0.2, 0.2, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // White background (full canvas)
    let vertices = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
    gl.uniform4f(u_color, 1, 1, 1, 1);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    // Black quadrant (top-left)
    let x = 0, y = 0, w = 128, h = 128;
    let x0 = (x / 256) * 2 - 1;
    let y0 = 1 - (y / 256) * 2;
    let x1 = ((x + w) / 256) * 2 - 1;
    let y1 = 1 - ((y + h) / 256) * 2;

    vertices = new Float32Array([x0, y0, x1, y0, x0, y1, x1, y1]);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
    gl.uniform4f(u_color, 0, 0, 0, 1);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    // Black quadrant (bottom-right)
    x = 128; y = 128;
    x0 = (x / 256) * 2 - 1;
    y0 = 1 - (y / 256) * 2;
    x1 = ((x + w) / 256) * 2 - 1;
    y1 = 1 - ((y + h) / 256) * 2;

    vertices = new Float32Array([x0, y0, x1, y0, x0, y1, x1, y1]);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
    gl.uniform4f(u_color, 0, 0, 0, 1);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    // Semi-transparent red overlay at 64,64
    x = 64; y = 64; w = 128; h = 128;
    x0 = (x / 256) * 2 - 1;
    y0 = 1 - (y / 256) * 2;
    x1 = ((x + w) / 256) * 2 - 1;
    y1 = 1 - ((y + h) / 256) * 2;

    vertices = new Float32Array([x0, y0, x1, y0, x0, y1, x1, y1]);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
    gl.uniform4f(u_color, 1, 0, 0, 0.5);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  `, {
    name: '2d-ui-rect-alpha',
    description: 'Semi-transparent red rect over checkerboard background',
    width: 256,
    height: 256,
    updateBaseline: process.env.UPDATE_VISUAL === '1',
    snapshotDir
  });
});

test('ui: gradient approximation', { timeout: 30000 }, async () => {
  await testWebGLRenderer(`
    const vertexShaderSource = [
      '#version 300 es',
      'in vec2 a_position;',
      'void main() {',
      '  gl_Position = vec4(a_position, 0.0, 1.0);',
      '}'
    ].join('\\n');

    const fragmentShaderSource = [
      '#version 300 es',
      'precision highp float;',
      'uniform vec4 u_color;',
      'out vec4 outColor;',
      'void main() {',
      '  outColor = u_color;',
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

    const vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);

    const a_position = gl.getAttribLocation(program, 'a_position');
    gl.vertexAttribPointer(a_position, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(a_position);

    const u_color = gl.getUniformLocation(program, 'u_color');

    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // Draw horizontal strips to simulate gradient from black to white
    for (let i = 0; i < 256; i += 16) {
      const val = i / 255;
      const x = i, y = 0, w = 16, h = 256;
      const x0 = (x / 256) * 2 - 1;
      const y0 = 1;
      const x1 = ((x + w) / 256) * 2 - 1;
      const y1 = -1;

      const vertices = new Float32Array([x0, y0, x1, y0, x0, y1, x1, y1]);
      gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
      gl.uniform4f(u_color, val, val, val, 1);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
  `, {
    name: '2d-ui-gradient',
    description: 'Horizontal gradient stripes black to white',
    width: 256,
    height: 256,
    updateBaseline: process.env.UPDATE_VISUAL === '1',
    snapshotDir
  });
});
