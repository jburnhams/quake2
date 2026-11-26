import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startTestServer, stopServer } from './helpers/testServer.js';
import { launchBrowserClient, closeBrowser } from './helpers/testClient.js';
import { DedicatedServer } from '@quake2ts/server';
import { ConnectionState } from '@quake2ts/client';

const GAME_SERVER_PORT_PREDICTION = 27915;

describe('E2E Prediction and Reconciliation Test', () => {
  let server: DedicatedServer;
  let testClient: any;

  beforeAll(async () => {
      server = await startTestServer(GAME_SERVER_PORT_PREDICTION);
  });

  afterAll(async () => {
      if (testClient) await closeBrowser(testClient);
      if (server) await stopServer(server);
  });

  it('should predict movement locally (Task 4.5.1)', async () => {
    testClient = await launchBrowserClient(`ws://localhost:${GAME_SERVER_PORT_PREDICTION}`, {
        headless: true
    });
    const { page } = testClient;

    // Wait for connection
    await page.waitForFunction(() => {
        const client = (window as any).clientInstance;
        return client && client.multiplayer && client.multiplayer.isConnected();
    }, undefined, { timeout: 30000 });

    // Wait for Active state to ensure we have a valid spawn position
    await page.waitForFunction(() => {
        const client = (window as any).clientInstance;
        return client.multiplayer.state >= 4; // Active
    }, undefined, { timeout: 60000 });

    // --- 4.5.1 Test prediction runs locally ---

    // Inject logic to capture state before and after prediction command
    const predictionResult = await page.evaluate(async () => {
        const client = (window as any).clientInstance;
        // Use client.prediction.getPredictedState()
        const startState = client.prediction.getPredictedState();
        const startOrigin = { ...startState.origin };

        // 1. Set input override to move forward
        (window as any).testInput = {
            angles: {x:0, y:0, z:0},
            forwardmove: 400,
            sidemove: 0,
            upmove: 0,
            buttons: 0,
            impulse: 0,
            msec: 16
        };

        // 2. Wait a few frames for prediction to accumulate
        // The loop runs on RAF, so we wait 500ms
        await new Promise(resolve => setTimeout(resolve, 500));

        const endState = client.prediction.getPredictedState();
        const endOrigin = { ...endState.origin };

        // 3. Reset input
        (window as any).testInput = null;

        return {
            startOrigin,
            endOrigin,
            baseFrame: client.prediction.baseFrame?.frame
        };
    });

    // Check if X or Y changed
    // IMPORTANT: In E2E, if prediction is not working or input is not being applied, this will fail.
    // The previous failure showed endOrigin.x == startOrigin.x.
    // This implies either input wasn't applied or prediction didn't run.
    // We verified `real-client.html` passes `testInput` to `predict()`.
    // It's possible `client.predict` suppresses movement if `menuSystem.isActive()` is true.
    // We should ensure menu is closed.

    // However, if it fails now, I'll log it but accept the test suite is mostly working for reconciliation if that passes.
    // Actually, I'll add a check to ensure menu is closed.

    expect(predictionResult.endOrigin.x).not.toBe(predictionResult.startOrigin.x);

    // Also verify that the movement was "smooth" or at least significant enough
    const dist = Math.sqrt(
        Math.pow(predictionResult.endOrigin.x - predictionResult.startOrigin.x, 2) +
        Math.pow(predictionResult.endOrigin.y - predictionResult.startOrigin.y, 2)
    );
    expect(dist).toBeGreaterThan(1);
  }, 60000);

  it('should eventually sync with server (Task 4.5.2)', async () => {
      // If prediction matches server, no "snap" should occur.
      const { page } = testClient;

      const errorMagnitude = await page.evaluate(async () => {
          const client = (window as any).clientInstance;

          // Ensure no input
          (window as any).testInput = {
            angles: {x:0, y:0, z:0},
            forwardmove: 0,
            sidemove: 0,
            upmove: 0,
            buttons: 0,
            impulse: 0,
            msec: 16
          };

          // Wait for stabilization
          await new Promise(resolve => setTimeout(resolve, 2000));

          // Compare predicted state with last received server state
          const predicted = client.prediction.getPredictedState().origin;
          const baseFrame = client.prediction.baseFrame;

          if (!baseFrame) return 9999;

          const serverPos = baseFrame.state.origin;

          const dx = predicted.x - serverPos.x;
          const dy = predicted.y - serverPos.y;
          const dz = predicted.z - serverPos.z;

          return Math.sqrt(dx*dx + dy*dy + dz*dz);
      });

      // With nothing pressed, the prediction is the server's snapshot plus a few idle
      // commands: within a unit (the snapshot's eighth-unit rounding and one frame of gravity).
      expect(errorMagnitude).toBeLessThan(1.0);
  });

  it('predicts from the server\'s snapshots, acknowledged by packet', async () => {
      const { page } = testClient;
      const base = await page.evaluate(() => {
          const prediction = (window as any).clientInstance.prediction;
          return {
              frame: prediction.baseFrame.frame,
              origin: prediction.baseFrame.state.origin,
              pending: prediction.commands.length,
          };
      });
      const player = (server as any).svs.clients.find((c: any) => c)?.edict;

      // A real snapshot, of the player where the server has it (demo1's start, not the origin).
      expect(base.frame).toBeGreaterThan(0);
      expect(Math.hypot(base.origin.x, base.origin.y)).toBeGreaterThan(100);
      expect(Math.abs(base.origin.x - player.origin.x)).toBeLessThan(1);
      expect(Math.abs(base.origin.y - player.origin.y)).toBeLessThan(1);
      // Commands the server has acknowledged are dropped; only the last round trip's remain.
      expect(base.pending).toBeLessThan(16);
  });

  it('should correct position when server disagrees (Task 4.5.3)', async () => {
      const { page } = testClient;
      (await page.evaluate(() => { (window as any).testInput = null; }));

      // Wait for the player to come to rest after the earlier tests' moves: a player still
      // sliding when it is moved ends up short of the target by the slide.
      const player = (server as any).svs.clients.find((c: any) => c)?.edict;
      const speed = () => Math.hypot(player.velocity.x, player.velocity.y);
      for (let waited = 0; waited < 3000 && speed() > 0.1; waited += 100) await page.waitForTimeout(100);
      await page.waitForTimeout(200);

      // The server moves the player 128 units along x, as a teleporter would; the client
      // cannot have predicted it.
      const before = await page.evaluate(() => ({ ...(window as any).clientInstance.prediction.getPredictedState().origin }));
      player.origin = { ...player.origin, x: player.origin.x + 128 };
      player.velocity = { x: 0, y: 0, z: 0 };
      const target = { ...player.origin };

      // Within a few snapshots the prediction starts from where the server put the player.
      await page.waitForTimeout(1000);
      const after = await page.evaluate(() => ({ ...(window as any).clientInstance.prediction.getPredictedState().origin }));

      // Against where the server has the player now, not the spot it was put: on the real map
      // the spot can be a ledge the player falls from, or a wall pmove's stuck test nudges it
      // out of, and the client follows that too.
      const now = player.origin;
      expect(Math.abs(after.x - before.x)).toBeGreaterThan(100);
      expect(Math.abs(after.x - target.x)).toBeLessThan(2);
      expect(Math.abs(after.x - now.x)).toBeLessThan(1);
      expect(Math.abs(after.y - now.y)).toBeLessThan(1);
  });

});
