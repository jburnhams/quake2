import { describe, test, expect, vi } from 'vitest';
import { createGame } from '../../src/index.js';
import { createNullRenderer } from '../../../test-utils/src/engine/renderers.js';
import { createTestContext } from '../../tests/test-helpers.js';

describe('Headless Rendering Integration', () => {
  test('runs game loop with NullRenderer', async () => {
    // Setup a minimal game environment with NullRenderer
    const renderer = createNullRenderer();
    const context = createTestContext();

    // Inject the renderer into the engine mock if possible,
    // or simulate the engine loop manually invoking the renderer.
    // Since createGame expects an Engine interface which includes renderFrame calls usually managed by the loop,
    // we simulate the loop here.

    const game = await createGame(context.imports, context.engine, {
      deathmatch: false
    });

    // Simulate a few frames
    for (let i = 0; i < 5; i++) {
      game.frame(16); // 16ms delta

      // Manually trigger a render frame as the game loop usually does this
      // The game.frame updates game state, then we render
      renderer.renderFrame({
        camera: context.engine.camera,
        cameraState: context.engine.camera.toState()
      }, []);
    }

    expect(renderer.getFrameCount()).toBe(5);
    const logs = renderer.getCallLog();
    expect(logs.some(l => l.includes('renderFrame'))).toBe(true);
    expect(logs.some(l => l.includes('camera: pos='))).toBe(true);
  });
});
