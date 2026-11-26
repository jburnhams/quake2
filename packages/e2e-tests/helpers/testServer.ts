import { DedicatedServer } from '@quake2ts/server';

// Helper to start a test server
// We can optionally pass config or mock imports if needed, but DedicatedServer creates its own.
// For e2e tests, we likely want the "real" server behavior.
export const startTestServer = async (port: number = 27910, mapName: string = 'maps/demo1.bsp', options: any = {}): Promise<DedicatedServer> => {
    // DedicatedServer now handles loading map from pak.pak automatically if file not found on disk.

    const server = new DedicatedServer({
        port,
        ...options
    });

    // However, start() is async because of map loading.
    await server.startServer(mapName);

    return server;
};

export const stopServer = async (server: DedicatedServer): Promise<void> => {
    server.stop();
};
