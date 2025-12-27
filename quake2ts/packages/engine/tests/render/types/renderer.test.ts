import { describe, test, expect } from 'vitest';
import type { RendererCapabilities, RenderCommand, RenderCommandLog } from '../../../src/render/types/renderer.js';

describe('Shared Renderer Types', () => {
  test('RendererCapabilities interface usage', () => {
    const caps: RendererCapabilities = {
      maxTextureSize: 4096,
      maxLights: 32,
      supportsCompute: false,
      supportsTimestampQuery: true
    };
    expect(caps.maxTextureSize).toBe(4096);
  });

  test('RenderCommandLog interface usage', () => {
    const log: RenderCommandLog = {
      commands: [
        { type: 'clear', timestamp: 100 },
        { type: 'draw' }
      ],
      stats: {
        drawCalls: 1,
        triangles: 100
      }
    };

    expect(log.commands.length).toBe(2);
    expect(log.stats.drawCalls).toBe(1);
    expect(log.commands[0].type).toBe('clear');
  });
});
