import { test } from 'vitest';
import { testWebGLRenderer } from '@quake2ts/test-utils';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const snapshotDir = path.join(__dirname, '..', '..', '__snapshots__');

test('renderer: drawString - basic', { timeout: 30000 }, async () => {
  await testWebGLRenderer(`
    // Create simple test font texture (16x8 grid of 8x8 characters = 128x64)
    const fontWidth = 128;
    const fontHeight = 64;
    const charWidth = 8;
    const charHeight = 8;
    const fontData = new Uint8Array(fontWidth * fontHeight * 4);

    // Fill with a simple pattern for each character
    for (let y = 0; y < fontHeight; y++) {
      for (let x = 0; x < fontWidth; x++) {
        const charX = Math.floor(x / charWidth);
        const charY = Math.floor(y / charHeight);
        const localX = x % charWidth;
        const localY = y % charHeight;

        // Create border for visibility
        const isBorder = localX === 0 || localX === 7 || localY === 0 || localY === 7;

        const idx = (y * fontWidth + x) * 4;
        if (isBorder) {
          fontData[idx + 0] = 255;
          fontData[idx + 1] = 255;
          fontData[idx + 2] = 255;
          fontData[idx + 3] = 255;
        } else {
          // Different pattern for each character
          const pattern = (charX + charY * 16) % 3;
          fontData[idx + 0] = pattern === 0 ? 200 : 100;
          fontData[idx + 1] = pattern === 1 ? 200 : 100;
          fontData[idx + 2] = pattern === 2 ? 200 : 100;
          fontData[idx + 3] = 255;
        }
      }
    }

    // Create font texture
    const fontTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, fontTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, fontWidth, fontHeight, 0, gl.RGBA, gl.UNSIGNED_BYTE, fontData);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

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
      'uniform vec4 u_color;',
      'out vec4 outColor;',
      'void main() {',
      '  vec4 texColor = texture(u_texture, v_texCoord);',
      '  outColor = texColor * u_color;',
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
    const a_texCoord = gl.getAttribLocation(program, 'a_texCoord');
    const u_color = gl.getUniformLocation(program, 'u_color');

    gl.vertexAttribPointer(a_position, 2, gl.FLOAT, false, 16, 0);
    gl.enableVertexAttribArray(a_position);
    gl.vertexAttribPointer(a_texCoord, 2, gl.FLOAT, false, 16, 8);
    gl.enableVertexAttribArray(a_texCoord);

    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    // Draw "HELLO WORLD" at position 10, 10
    const text = "HELLO WORLD";
    let drawX = 10;
    const drawY = 10;

    for (let i = 0; i < text.length; i++) {
      const charCode = text.charCodeAt(i);
      const charX = (charCode % 16) * charWidth;
      const charY = Math.floor(charCode / 16) * charHeight;

      // UV coordinates in the font texture
      const u0 = charX / fontWidth;
      const v0 = charY / fontHeight;
      const u1 = (charX + charWidth) / fontWidth;
      const v1 = (charY + charHeight) / fontHeight;

      // Screen coordinates (NDC)
      const x0 = (drawX / 256) * 2 - 1;
      const y0 = 1 - (drawY / 256) * 2;
      const x1 = ((drawX + charWidth) / 256) * 2 - 1;
      const y1 = 1 - ((drawY + charHeight) / 256) * 2;

      const vertices = new Float32Array([
        x0, y0, u0, v0,
        x1, y0, u1, v0,
        x0, y1, u0, v1,
        x1, y1, u1, v1,
      ]);

      gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
      gl.uniform4f(u_color, 1, 1, 1, 1);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      drawX += charWidth;
    }
  `, {
    name: '2d-text-simple',
    description: 'Text "HELLO WORLD" with debug font',
    width: 256,
    height: 256,
    updateBaseline: process.env.UPDATE_VISUAL === '1',
    snapshotDir
  });
});

test('text: multi-line', { timeout: 30000 }, async () => {
  await testWebGLRenderer(`
    // Create font texture
    const fontWidth = 128;
    const fontHeight = 64;
    const charWidth = 8;
    const charHeight = 8;
    const fontData = new Uint8Array(fontWidth * fontHeight * 4);

    for (let y = 0; y < fontHeight; y++) {
      for (let x = 0; x < fontWidth; x++) {
        const charX = Math.floor(x / charWidth);
        const charY = Math.floor(y / charHeight);
        const localX = x % charWidth;
        const localY = y % charHeight;

        const isBorder = localX === 0 || localX === 7 || localY === 0 || localY === 7;

        const idx = (y * fontWidth + x) * 4;
        if (isBorder) {
          fontData[idx + 0] = 255;
          fontData[idx + 1] = 255;
          fontData[idx + 2] = 255;
          fontData[idx + 3] = 255;
        } else {
          const pattern = (charX + charY * 16) % 3;
          fontData[idx + 0] = pattern === 0 ? 200 : 100;
          fontData[idx + 1] = pattern === 1 ? 200 : 100;
          fontData[idx + 2] = pattern === 2 ? 200 : 100;
          fontData[idx + 3] = 255;
        }
      }
    }

    const fontTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, fontTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, fontWidth, fontHeight, 0, gl.RGBA, gl.UNSIGNED_BYTE, fontData);
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
      'uniform vec4 u_color;',
      'out vec4 outColor;',
      'void main() {',
      '  vec4 texColor = texture(u_texture, v_texCoord);',
      '  outColor = texColor * u_color;',
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
    const a_texCoord = gl.getAttribLocation(program, 'a_texCoord');
    const u_color = gl.getUniformLocation(program, 'u_color');

    gl.vertexAttribPointer(a_position, 2, gl.FLOAT, false, 16, 0);
    gl.enableVertexAttribArray(a_position);
    gl.vertexAttribPointer(a_texCoord, 2, gl.FLOAT, false, 16, 8);
    gl.enableVertexAttribArray(a_texCoord);

    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    // Draw three lines
    const lines = ["LINE ONE", "LINE TWO", "LINE THREE"];
    const startY = 10;

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      const text = lines[lineIdx];
      let drawX = 10;
      const drawY = startY + lineIdx * 10;

      for (let i = 0; i < text.length; i++) {
        const charCode = text.charCodeAt(i);
        const charX = (charCode % 16) * charWidth;
        const charY = Math.floor(charCode / 16) * charHeight;

        const u0 = charX / fontWidth;
        const v0 = charY / fontHeight;
        const u1 = (charX + charWidth) / fontWidth;
        const v1 = (charY + charHeight) / fontHeight;

        const x0 = (drawX / 256) * 2 - 1;
        const y0 = 1 - (drawY / 256) * 2;
        const x1 = ((drawX + charWidth) / 256) * 2 - 1;
        const y1 = 1 - ((drawY + charHeight) / 256) * 2;

        const vertices = new Float32Array([
          x0, y0, u0, v0,
          x1, y0, u1, v0,
          x0, y1, u0, v1,
          x1, y1, u1, v1,
        ]);

        gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
        gl.uniform4f(u_color, 1, 1, 1, 1);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

        drawX += charWidth;
      }
    }
  `, {
    name: '2d-text-multiline',
    description: 'Three lines of text',
    width: 256,
    height: 256,
    updateBaseline: process.env.UPDATE_VISUAL === '1',
    snapshotDir
  });
});

test('text: colored', { timeout: 30000 }, async () => {
  await testWebGLRenderer(`
    // Create font texture
    const fontWidth = 128;
    const fontHeight = 64;
    const charWidth = 8;
    const charHeight = 8;
    const fontData = new Uint8Array(fontWidth * fontHeight * 4);

    for (let y = 0; y < fontHeight; y++) {
      for (let x = 0; x < fontWidth; x++) {
        const charX = Math.floor(x / charWidth);
        const charY = Math.floor(y / charHeight);
        const localX = x % charWidth;
        const localY = y % charHeight;

        const isBorder = localX === 0 || localX === 7 || localY === 0 || localY === 7;

        const idx = (y * fontWidth + x) * 4;
        if (isBorder) {
          fontData[idx + 0] = 255;
          fontData[idx + 1] = 255;
          fontData[idx + 2] = 255;
          fontData[idx + 3] = 255;
        } else {
          const pattern = (charX + charY * 16) % 3;
          fontData[idx + 0] = pattern === 0 ? 200 : 100;
          fontData[idx + 1] = pattern === 1 ? 200 : 100;
          fontData[idx + 2] = pattern === 2 ? 200 : 100;
          fontData[idx + 3] = 255;
        }
      }
    }

    const fontTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, fontTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, fontWidth, fontHeight, 0, gl.RGBA, gl.UNSIGNED_BYTE, fontData);
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
      'uniform vec4 u_color;',
      'out vec4 outColor;',
      'void main() {',
      '  vec4 texColor = texture(u_texture, v_texCoord);',
      '  outColor = texColor * u_color;',
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
    const a_texCoord = gl.getAttribLocation(program, 'a_texCoord');
    const u_color = gl.getUniformLocation(program, 'u_color');

    gl.vertexAttribPointer(a_position, 2, gl.FLOAT, false, 16, 0);
    gl.enableVertexAttribArray(a_position);
    gl.vertexAttribPointer(a_texCoord, 2, gl.FLOAT, false, 16, 8);
    gl.enableVertexAttribArray(a_texCoord);

    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    // Draw colored lines
    const lines = [
      { text: "RED TEXT", y: 10, color: [1, 0, 0, 1] },
      { text: "GREEN TEXT", y: 30, color: [0, 1, 0, 1] },
      { text: "BLUE TEXT", y: 50, color: [0, 0, 1, 1] }
    ];

    for (let j = 0; j < lines.length; j++) {
      const line = lines[j];
      let drawX = 10;
      const drawY = line.y;

      for (let i = 0; i < line.text.length; i++) {
        const charCode = line.text.charCodeAt(i);
        const charX = (charCode % 16) * charWidth;
        const charY = Math.floor(charCode / 16) * charHeight;

        const u0 = charX / fontWidth;
        const v0 = charY / fontHeight;
        const u1 = (charX + charWidth) / fontWidth;
        const v1 = (charY + charHeight) / fontHeight;

        const x0 = (drawX / 256) * 2 - 1;
        const y0 = 1 - (drawY / 256) * 2;
        const x1 = ((drawX + charWidth) / 256) * 2 - 1;
        const y1 = 1 - ((drawY + charHeight) / 256) * 2;

        const vertices = new Float32Array([
          x0, y0, u0, v0,
          x1, y0, u1, v0,
          x0, y1, u0, v1,
          x1, y1, u1, v1,
        ]);

        gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
        gl.uniform4f(u_color, line.color[0], line.color[1], line.color[2], line.color[3]);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

        drawX += charWidth;
      }
    }
  `, {
    name: '2d-text-colored',
    description: 'Text rendered with different tint colors',
    width: 256,
    height: 256,
    updateBaseline: process.env.UPDATE_VISUAL === '1',
    snapshotDir
  });
});
