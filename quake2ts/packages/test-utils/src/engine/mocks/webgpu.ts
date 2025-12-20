// Mock WebGPU types if not available in environment
export type GPUAdapter = any;
export type GPUDevice = any;
export type GPUCanvasContext = any;

export const createMockWebGPU = () => ({
  adapter: {} as GPUAdapter,
  device: {} as GPUDevice,
  context: {} as GPUCanvasContext
});
