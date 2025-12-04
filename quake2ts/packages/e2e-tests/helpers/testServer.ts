import { DedicatedServer } from '@quake2ts/server';

// Helper to start a test server
// We can optionally pass config or mock imports if needed, but DedicatedServer creates its own.
// For e2e tests, we likely want the "real" server behavior.
export const startTestServer = async (port: number = 27910, mapName: string = 'maps/q2dm1.bsp'): Promise<DedicatedServer> => {
    const server = new DedicatedServer(port);

    // In a real e2e environment, we might need to ensure assets exist.
    // For now, we assume the server can start even if map loading fails (it catches error).
    // Or we might want to mock the file system read in DedicatedServer if we are testing logic only.
    // However, for E2E, we want "real" behavior.

    // We can't await start() because it runs the loop indefinitely?
    // Looking at DedicatedServer.start():
    // It calls runFrame() which uses setTimeout. It does NOT block.
    // So we can await start().

    // However, start() is async because of map loading.
    await server.start(mapName);

    return server;
};

export const stopServer = async (server: DedicatedServer): Promise<void> => {
    server.stop();
};
