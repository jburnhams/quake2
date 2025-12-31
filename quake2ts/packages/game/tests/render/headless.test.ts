import { describe, test, expect, vi } from 'vitest';
import { createGame } from '../../src/index.js';
import { createNullRenderer } from '@quake2ts/test-utils';
import { createGameImportsAndEngine } from '@quake2ts/test-utils/game/helpers';
import { Camera } from '@quake2ts/engine';

describe('Headless Rendering Integration', () => {
  test('runs game loop with NullRenderer', async () => {
    // Setup a minimal game environment with NullRenderer
    const renderer = createNullRenderer();
    const camera = new Camera(); // Create a real camera for the test

    // Pass the camera to the engine mock
    const { imports, engine } = createGameImportsAndEngine({
      engine: {
        camera
      }
    });

    // Inject the renderer into the engine mock if possible,
    // or simulate the engine loop manually invoking the renderer.

    const game = await createGame(imports, engine, {
      deathmatch: false,
      gravity: [0, 0, -800] // Provide gravity to avoid undefined errors in physics loop
    });

    // Simulate a few frames
    for (let i = 0; i < 5; i++) {
      game.frame(16); // 16ms delta

      // Manually trigger a render frame as the game loop usually does this
      // The game.frame updates game state, then we render
      renderer.renderFrame({
        camera: engine.camera!,
        cameraState: engine.camera!.toState()
      }, []);
    }

    expect(renderer.getFrameCount()).toBe(5);
    const logs = renderer.getCallLog();
    expect(logs.some(l => l.includes('renderFrame'))).toBe(true);
    expect(logs.some(l => l.includes('camera: pos='))).toBe(true);
  });
});
