import { vi } from 'vitest';

export const renderFrame = vi.fn((...args) => {
  // console.log('MockFrameRenderer.renderFrame called with:', JSON.stringify(args, null, 2));
  return {
    drawCalls: 0,
    vertexCount: 0,
    batches: 0,
    facesDrawn: 0,
    skyDrawn: false,
    viewModelDrawn: false,
    fps: 60,
    shaderSwitches: 0,
    visibleSurfaces: 0,
    culledSurfaces: 0,
    visibleEntities: 0,
    culledEntities: 0
  };
});

export const createFrameRenderer = vi.fn(() => ({
  renderFrame
}));
