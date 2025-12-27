import { test } from 'vitest';
import { testWebGLRenderer } from '@quake2ts/test-utils';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const snapshotDir = path.join(__dirname, '..', '..', '__snapshots__');

test('Texture Filtering: Nearest vs Linear', { timeout: 30000 }, async () => {
  await testWebGLRenderer(`
    gl.clearColor(0.2, 0.2, 0.2, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // Create a 2x2 texture with 4 colors
    const tex = new Quake2Engine.Texture2D(gl);
    const data = new Uint8Array([
      255, 0, 0, 255,   0, 255, 0, 255,
      0, 0, 255, 255,   255, 255, 0, 255
    ]);
    tex.upload(2, 2, data);

    // Draw left quad using Nearest filtering
    tex.setParameters({
      minFilter: gl.NEAREST,
      magFilter: gl.NEAREST
    });
    renderer.begin2D();
    renderer.drawPic(10, 50, tex);
    renderer.end2D();

    // Draw right quad using Linear filtering
    tex.setParameters({
      minFilter: gl.LINEAR,
      magFilter: gl.LINEAR
    });
    renderer.begin2D();
    renderer.drawPic(146, 50, tex);
    renderer.end2D();
  `, {
    name: 'texture-filtering-nearest-linear',
    description: 'Compares NEAREST vs LINEAR magnification filtering on a 2x2 texture',
    width: 256,
    height: 256,
    updateBaseline: process.env.UPDATE_VISUAL === '1',
    snapshotDir
  });
});

test('Texture Filtering: Mipmapping', { timeout: 30000 }, async () => {
  await testWebGLRenderer(`
    gl.clearColor(0.2, 0.2, 0.2, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // Create a texture with mipmaps
    // 32x32: Red
    // 16x16: Green
    // 8x8: Blue
    // 4x4: Yellow
    // 2x2: Cyan
    // 1x1: Magenta
    const tex = new Quake2Engine.Texture2D(gl);

    const colors = [
      [255, 0, 0, 255],     // 32x32 Red
      [0, 255, 0, 255],     // 16x16 Green
      [0, 0, 255, 255],     // 8x8 Blue
      [255, 255, 0, 255],   // 4x4 Yellow
      [0, 255, 255, 255],   // 2x2 Cyan
      [255, 0, 255, 255]    // 1x1 Magenta
    ];

    tex.bind();
    let size = 32;
    for (let i = 0; i < colors.length; i++) {
       const color = colors[i];
       const data = new Uint8Array(size * size * 4);
       for (let j = 0; j < data.length; j += 4) {
         data[j] = color[0];
         data[j+1] = color[1];
         data[j+2] = color[2];
         data[j+3] = color[3];
       }
       tex.uploadImage(i, gl.RGBA, size, size, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
       size /= 2;
    }

    tex.setParameters({
      minFilter: gl.NEAREST_MIPMAP_NEAREST,
      magFilter: gl.NEAREST
    });

    // Draw at different scales to trigger mipmaps
    renderer.begin2D();
    // Large (Base level - Red)
    // Manually invoking spriteRenderer to control size
    // renderer.drawPic uses tex.width/height by default which is just the base size

    // Note: Since renderer.drawPic uses internal spriteRenderer.draw(..., w, h, ...),
    // it draws it at the texture's native resolution if passed directly if we don't scale it.
    // The renderer.drawPic signature is (x, y, pic, color). It draws at pic.width/height.

    // To test mipmaps we need to draw at different screen sizes.
    // We can't easily change the size with drawPic unless we hack the pic object or use spriteRenderer directly.
    // But spriteRenderer is not exposed directly on the renderer object.
    // BUT! I can use a trick:
    // define a fake pic object with modified dimensions.

    const drawScaled = (x, y, w, h) => {
       const fakePic = {
         width: w,
         height: h,
         texture: tex.texture,
         bind: (unit) => tex.bind(unit)
       };
       // The renderer casts it to Texture2D to call bind, so we need a bind method.
       // It also accesses .texture property for framebuffers but drawPic doesn't need it.
       renderer.drawPic(x, y, fakePic);
    };

    // Actually, drawPic implementation:
    // (pic as Texture2D).bind(0);
    // spriteRenderer.draw(x, y, pic.width, pic.height, 0, 0, 1, 1, color);

    // So if I pass an object that looks like a Texture2D (has bind, width, height), it should work.

    const makeFakePic = (w, h) => {
        return {
            bind: (u) => tex.bind(u),
            width: w,
            height: h,
            target: tex.target,
            texture: tex.texture
        };
    };

    renderer.drawPic(10, 10, makeFakePic(64, 64)); // Red
    renderer.drawPic(90, 10, makeFakePic(16, 16)); // Green
    renderer.drawPic(130, 10, makeFakePic(4, 4));  // Yellow

    renderer.end2D();

  `, {
    name: 'texture-filtering-mipmaps',
    description: 'Verifies mipmap selection by rendering a texture with distinct colors per mip level at different scales',
    width: 256,
    height: 128,
    updateBaseline: process.env.UPDATE_VISUAL === '1',
    snapshotDir
  });
});
