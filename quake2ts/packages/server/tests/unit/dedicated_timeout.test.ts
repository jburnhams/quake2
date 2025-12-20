
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DedicatedServer } from '../../src/dedicated.js';
import { ClientState } from '../../src/client.js';
import { createMockTransport, MockTransport, createMockServerClient } from '@quake2ts/test-utils';
import { NetDriver } from '@quake2ts/shared';

// Mock dependencies
vi.mock('node:fs/promises', async () => {
    return {
        default: {
            readFile: vi.fn().mockResolvedValue(Buffer.from(''))
        },
        readFile: vi.fn().mockResolvedValue(Buffer.from(''))
    };
});

// Mock game creation
vi.mock('@quake2ts/game', async () => {
    const actual = await vi.importActual('@quake2ts/game');
    return {
        ...actual,
        createGame: vi.fn().mockReturnValue({
            init: vi.fn(),
            spawnWorld: vi.fn(),
            shutdown: vi.fn(),
            frame: vi.fn().mockReturnValue({ state: {} }),
            entities: {
                getByIndex: vi.fn(),
                forEachEntity: vi.fn()
            },
            clientConnect: vi.fn().mockReturnValue(true),
            clientBegin: vi.fn().mockReturnValue({ index: 1, origin: {x:0,y:0,z:0} }),
            clientDisconnect: vi.fn(),
            clientThink: vi.fn()
        }),
        createPlayerInventory: vi.fn(),
        createPlayerWeaponStates: vi.fn()
    };
});

// Access private properties for testing
function getPrivate(obj: any, key: string) {
    return obj[key];
}

describe('DedicatedServer Timeout', () => {
    let server: DedicatedServer;
    let consoleLogSpy: any;
    let consoleWarnSpy: any;
    let transport: MockTransport;

    beforeEach(async () => {
        vi.useFakeTimers({
            toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date']
        });
        consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
        consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        transport = createMockTransport();
        server = new DedicatedServer({ port: 27910, transport });
        await server.startServer('maps/test.bsp');
    });

    afterEach(() => {
        server.stopServer();
        vi.clearAllMocks();
        consoleLogSpy.mockRestore();
        consoleWarnSpy.mockRestore();
        vi.useRealTimers();
    });

    it('should disconnect a client after timeout', () => {
        // Access svs.clients to manually inject a client
        const svs = getPrivate(server, 'svs');
        const sv = getPrivate(server, 'sv');

        // Mock a connected client
        const mockDriver: NetDriver = {
            send: vi.fn(),
            disconnect: vi.fn(),
            connect: vi.fn(),
            attach: vi.fn(),
            onMessage: vi.fn(),
            onClose: vi.fn(),
            onError: vi.fn(),
            isConnected: vi.fn().mockReturnValue(true)
        };

        const clientIndex = 0;
        const client = createMockServerClient(clientIndex, {
            net: mockDriver,
            lastMessage: sv.frame, // Last message was NOW
            lastConnect: Date.now(),
            name: 'TestClient'
        });

        svs.clients[clientIndex] = client;

        // Set up cleanup spy
        const dropClientSpy = vi.spyOn(server as any, 'dropClient');

        // Advance 29 seconds (290 frames)
        for(let i=0; i<290; i++) {
            vi.runOnlyPendingTimers();
        }

        // Verify still connected
        expect(svs.clients[clientIndex]).not.toBeNull();
        expect(dropClientSpy).not.toHaveBeenCalled();
        expect(mockDriver.disconnect).not.toHaveBeenCalled();

        // Advance another 20 frames (2 seconds) -> Total 31 seconds
        for(let i=0; i<20; i++) {
             vi.runOnlyPendingTimers();
        }

        // Now diff is 310 > 300. Should disconnect.
        expect(dropClientSpy).toHaveBeenCalledWith(client);
        expect(mockDriver.disconnect).toHaveBeenCalled();
    });

    it('should NOT disconnect a client if they send messages', () => {
        const svs = getPrivate(server, 'svs');
        const sv = getPrivate(server, 'sv');

        const mockDriver: NetDriver = {
            send: vi.fn(),
            disconnect: vi.fn(),
            connect: vi.fn(),
            attach: vi.fn(),
            onMessage: vi.fn(),
            onClose: vi.fn(),
            onError: vi.fn(),
            isConnected: vi.fn().mockReturnValue(true)
        };

        const clientIndex = 0;
        const client = createMockServerClient(clientIndex, {
            net: mockDriver,
            lastMessage: sv.frame,
            lastConnect: Date.now(),
            name: 'TestClient'
        });

        svs.clients[clientIndex] = client;
        const dropClientSpy = vi.spyOn(server as any, 'dropClient');

        // Advance 15 seconds
        for(let i=0; i<150; i++) {
            vi.runOnlyPendingTimers();
        }

        // Simulate packet received -> updates lastMessage
        client.lastMessage = sv.frame;

        // Advance another 16 seconds
        for(let i=0; i<160; i++) {
            vi.runOnlyPendingTimers();
        }

        // Total time 31 seconds, but lastMessage was 16 seconds ago.
        expect(dropClientSpy).not.toHaveBeenCalled();
    });
});
