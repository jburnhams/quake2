import { DedicatedServer } from '@quake2ts/server';
import { extractMapFromPak } from '../scripts/extractMap.js';
import path from 'path';
import fs from 'fs';

// Helper to start a test server
// We can optionally pass config or mock imports if needed, but DedicatedServer creates its own.
// For e2e tests, we likely want the "real" server behavior.
export const startTestServer = async (port: number = 27910, mapName: string = 'maps/demo1.bsp'): Promise<DedicatedServer> => {
    // Ensure map exists
    // We assume we are running from project root or somewhere we can find pak.pak
    // Try to find pak.pak
    const possiblePakPaths = ['pak.pak', '../../pak.pak', '../../../pak.pak'];
    const pakPath = possiblePakPaths.find(p => fs.existsSync(p));

    if (pakPath && !fs.existsSync(mapName)) {
        console.log(`Extracting ${mapName} from ${pakPath} for test...`);
        extractMapFromPak(mapName, path.dirname(mapName), pakPath);
    }

    const server = new DedicatedServer(port);

    // However, start() is async because of map loading.
    await server.start(mapName);

    return server;
};

export const stopServer = async (server: DedicatedServer): Promise<void> => {
    server.stop();
};
