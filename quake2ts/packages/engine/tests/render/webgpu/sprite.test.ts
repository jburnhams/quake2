import { describe, it, expect } from 'vitest';
import { initHeadlessWebGPU } from '@quake2ts/test-utils';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('WebGPU Sprite Shader', () => {
  it('compiles without errors', async () => {
    // Setup headless WebGPU
    const { device } = await initHeadlessWebGPU();

    // Read shader code
    // The test is in packages/engine/tests/render/webgpu/sprite.test.ts
    // The source is in packages/engine/src/render/webgpu/shaders/sprite.wgsl
    // __dirname is packages/engine/tests/render/webgpu
    // So we need to go up 4 levels to packages/engine
    // Then src/render/webgpu/shaders/sprite.wgsl

    // Wait, ../../../../ takes us to packages/engine/
    // src/render/webgpu/shaders/sprite.wgsl

    // The error said: ENOENT: no such file or directory, open '/app/quake2ts/packages/src/render/webgpu/shaders/sprite.wgsl'
    // It seems it resolved to packages/src... which means we went up one too many levels or something?

    // If __dirname is /app/quake2ts/packages/engine/tests/render/webgpu
    // .. -> render
    // .. -> tests
    // .. -> engine
    // .. -> packages

    // So ../../../../ is packages.
    // Then src/render... would be packages/src... which is wrong.
    // We want packages/engine/src...

    // So we need ../../../src/render/webgpu/shaders/sprite.wgsl

    const shaderPath = join(__dirname, '../../../src/render/webgpu/shaders/sprite.wgsl');

    const shaderCode = readFileSync(shaderPath, 'utf8');

    // Create shader module
    const shaderModule = device.createShaderModule({
      label: 'Sprite Shader',
      code: shaderCode,
    });

    // Check compilation info
    const info = await shaderModule.getCompilationInfo();
    const errors = info.messages.filter(m => m.type === 'error');

    expect(errors.length).toBe(0);

    if (errors.length > 0) {
      console.error('Shader compilation errors:', errors);
    }
  });
});
