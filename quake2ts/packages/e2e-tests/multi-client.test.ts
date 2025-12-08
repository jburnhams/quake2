import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startTestServer, stopServer } from './helpers/testServer.js';
import { launchBrowserClient, closeBrowser, TestClient } from './helpers/testClient.js';
import { DedicatedServer } from '@quake2ts/server';

const GAME_SERVER_PORT_MULTI = 27916;

describe('E2E Multi-Client Test', () => {
  let server: DedicatedServer;
  let client1: TestClient;
  let client2: TestClient;

  beforeAll(async () => {
      server = await startTestServer(GAME_SERVER_PORT_MULTI);
  });

  afterAll(async () => {
      if (client1) await closeBrowser(client1);
      if (client2) await closeBrowser(client2);
      if (server) await stopServer(server);
  });

  it('should allow two clients to connect (Task 4.6.1)', async () => {
      // Launch Client 1
      client1 = await launchBrowserClient(`ws://localhost:${GAME_SERVER_PORT_MULTI}`, {
          headless: true,
          queryParams: { name: 'Player1' }
      });

      console.log('Client 1 launched, waiting for active...');
      await client1.page.waitForFunction(() => {
          const client = (window as any).clientInstance;
          return client && client.multiplayer && client.multiplayer.state >= 4;
      }, undefined, { timeout: 30000 });
      console.log('Client 1 active.');

      // Launch Client 2
      client2 = await launchBrowserClient(`ws://localhost:${GAME_SERVER_PORT_MULTI}`, {
          headless: true,
          queryParams: { name: 'Player2' }
      });

      console.log('Client 2 launched, waiting for active...');
      await client2.page.waitForFunction(() => {
          const client = (window as any).clientInstance;
          return client && client.multiplayer && client.multiplayer.state >= 4;
      }, undefined, { timeout: 30000 });
      console.log('Client 2 active.');

      // Check server state - wait for propagation
      await new Promise<void>((resolve, reject) => {
          const start = Date.now();
          const interval = setInterval(() => {
              const clients = (server as any).svs.clients;
              const activeClients = clients.filter((c: any) => c && c.state >= 4);
              if (activeClients.length >= 2) {
                  clearInterval(interval);
                  resolve();
              } else if (Date.now() - start > 10000) {
                  clearInterval(interval);
                  reject(new Error(`Timeout waiting for server clients. Active: ${activeClients.length}`));
              }
          }, 100);
      });

      const clients = (server as any).svs.clients;
      const activeClients = clients.filter((c: any) => c && c.state >= 4);
      expect(activeClients.length).toBeGreaterThanOrEqual(2);
  });

  it('should replicate player entities to other clients (Task 4.6.2)', async () => {
      // Wait for a few frame updates to propagate entities
      await new Promise(resolve => setTimeout(resolve, 2000));

      const client2SeeClient1 = await client2.page.evaluate(() => {
          const client = (window as any).clientInstance;
          // PlayerNum is 0-based index. Entity number is playerNum + 1.
          const myEntNum = client.multiplayer.playerNum + 1;

          // demoHandler.entities is a Map<number, EntityState>
          const entities = Array.from(client.demoHandler.entities.values());

          // Debug info
          const debugInfo = entities.map((e: any) => ({
              num: e.number,
              model: e.modelIndex, // Note: modelIndex, not modelindex (JS convention in some parts? Check interface)
              origin: e.origin
          }));
          console.log('Client 2 Entities:', JSON.stringify(debugInfo));

          // Look for other players (modelIndex > 0 usually indicates visibility/existence)
          const others = entities.filter((e: any) => {
              return e.number !== myEntNum && (e.modelIndex > 0 || e.modelindex > 0);
          });

          return others.length;
      });

      console.log(`Client 2 sees ${client2SeeClient1} other players.`);
      expect(client2SeeClient1).toBeGreaterThan(0);
  });

  it('should sync player movement between clients (Task 4.6.3)', async () => {
      // Move Client 1
      const startPosC1 = await client1.page.evaluate(() => {
          const client = (window as any).clientInstance;
          return { ...client.prediction.getPredictedState().origin };
      });

      console.log('Client 1 Start Pos:', startPosC1);

      // Move forward
      await client1.page.evaluate(() => {
          (window as any).testInput = {
            angles: {x:0, y:0, z:0},
            forwardmove: 400,
            sidemove: 0,
            upmove: 0,
            buttons: 0,
            impulse: 0,
            msec: 16
          };
      });

      await new Promise(resolve => setTimeout(resolve, 1500));

      // Stop moving
      await client1.page.evaluate(() => {
          (window as any).testInput = null;
      });

      // Get new position
      const endPosC1 = await client1.page.evaluate(() => {
          const client = (window as any).clientInstance;
          return { ...client.prediction.getPredictedState().origin };
      });

      console.log('Client 1 End Pos:', endPosC1);
      expect(endPosC1.x).not.toBe(startPosC1.x);

      // Wait for Client 2 to receive update
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Verify Client 2 saw Client 1 move
      const client1PosInClient2 = await client2.page.evaluate(() => {
          const client = (window as any).clientInstance;
          const myEntNum = client.multiplayer.playerNum + 1;
          const entities = Array.from(client.demoHandler.entities.values());
          const other = entities.find((e: any) => e.number !== myEntNum && (e.modelIndex > 0 || e.modelindex > 0));

          return other ? { ...other.origin } : null;
      });

      console.log('Client 1 Pos in Client 2:', client1PosInClient2);

      expect(client1PosInClient2).not.toBeNull();

      if (client1PosInClient2) {
          const dist = Math.abs(client1PosInClient2.x - endPosC1.x);
          // Tolerance due to network latency/interpolation/compression (integers)
          console.log(`Distance delta: ${dist}`);
          expect(dist).toBeLessThan(50);
      }
  });
});
