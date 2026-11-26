/**
 * WebGPU Device Lifecycle Management for Integration Tests
 *
 * Provides utilities to track and cleanup GPUDevice instances created during tests,
 * preventing resource leaks.
 *
 * Usage:
 * ```ts
 * describe('My WebGPU Tests', () => {
 *   const lifecycle = createWebGPULifecycle();
 *
 *   beforeAll(async () => {
 *     await initHeadlessWebGPU();
 *   });
 *
 *   afterAll(lifecycle.cleanup);
 *
 *   it('test', async () => {
 *     const context = await createWebGPUContext();
 *     lifecycle.track(context.device);
 *     // ... test code
 *   });
 * });
 * ```
 */

export interface WebGPULifecycle {
  /**
   * Track a GPUDevice for cleanup
   */
  track(device: GPUDevice): void;

  /**
   * Track a renderer with a device property for cleanup
   */
  trackRenderer(renderer: { device: GPUDevice; dispose: () => void }): void;

  /**
   * Cleanup all tracked devices
   * Call this in afterAll hook
   */
  cleanup(): Promise<void>;

  /**
   * Get count of tracked devices
   */
  count(): number;
}

/**
 * Create a WebGPU lifecycle manager for tracking and cleaning up devices
 */
export function createWebGPULifecycle(): WebGPULifecycle {
  const devices: GPUDevice[] = [];
  const renderers: Array<{ device: GPUDevice; dispose: () => void }> = [];

  return {
    track(device: GPUDevice): void {
      devices.push(device);
    },

    trackRenderer(renderer: { device: GPUDevice; dispose: () => void }): void {
      renderers.push(renderer);
    },

    async cleanup(): Promise<void> {
      // Dispose renderers first (they may destroy their devices)
      for (const renderer of renderers) {
        try {
          renderer.dispose();
        } catch (e) {
          console.warn('Error disposing renderer:', e);
        }
      }
      renderers.length = 0;

      // Collect all devices and their lost promises
      const allDevices = [...devices];
      devices.length = 0;

      if (allDevices.length === 0) return;

      // Wait for all devices to be destroyed
      const lostPromises = allDevices.map(d => d.lost);
      for (const device of allDevices) {
        try {
          device.destroy();
        } catch (e) {
          // Device might already be destroyed
          console.warn('Error destroying device:', e);
        }
      }

      // Wait for all devices to report as lost
      await Promise.all(lostPromises);
    },

    count(): number {
      return devices.length + renderers.length;
    }
  };
}
