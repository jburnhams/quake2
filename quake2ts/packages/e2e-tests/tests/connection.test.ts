import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DedicatedServer, WebSocketNetDriver } from '@quake2ts/server';
import { MultiplayerConnection } from '@quake2ts/client';
import { ConnectionState } from '@quake2ts/client/src/net/connection.js'; // Import enum
import { createGame } from '@quake2ts/game';

// Helper to delay
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('Client-Server Integration', () => {
  let server: DedicatedServer;
  let client: MultiplayerConnection;
  const PORT = 27999;
  const URL = `ws://localhost:${PORT}`;

  beforeEach(async () => {
    // Start Server
    server = new DedicatedServer({
      port: PORT,
      gameFactory: createGame,
      maxClients: 4,
    });
    await server.start('test_map'); // Provide a dummy map name
  });

  afterEach(async () => {
    if (client) {
      client.disconnect();
    }
    if (server) {
      server.stop();
    }
  });

  it('should allow a client to connect and handshake', async () => {
    // Create Client with Node WebSocket Driver
    client = new MultiplayerConnection({
      username: 'TestPlayer',
      model: 'male',
      skin: 'grunt',
      driver: new WebSocketNetDriver(), // Inject Node driver
    });

    // Connect
    await client.connect(URL);
    expect(client.isConnected()).toBe(false); // Still handshaking

    // Wait for handshake
    // The server runs its own loop (via start()), so we just wait.
    let connected = false;
    for (let i = 0; i < 30; i++) { // Wait up to 3 seconds
      await sleep(100);

      if (client.isConnected()) {
        connected = true;
        break;
      }
    }

    expect(connected).toBe(true);
    expect(client.levelName).toBeDefined();
    expect(client.serverProtocol).toBeGreaterThan(0);
  });
});
