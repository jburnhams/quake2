import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ServerBrowser } from '@quake2ts/client/net/serverBrowser.js';
import { DedicatedServer } from '@quake2ts/server';
import { NetDriver, BinaryWriter, ServerCommand, NetChan } from '@quake2ts/shared';
import { MockNetDriver } from '@quake2ts/test-utils';
import { BrowserWebSocketNetDriver } from '@quake2ts/client/net/browserWsDriver.js';

let lastMockDriver: MockNetDriver | null = null;

// Mock dependencies
vi.mock('@quake2ts/client/net/browserWsDriver.js', () => {
    return {
        BrowserWebSocketNetDriver: class {
            constructor() {
                const driver = new MockNetDriver();
                lastMockDriver = driver;
                return driver;
            }
        }
    };
});

describe('ServerBrowser', () => {
    let browser: ServerBrowser;

    beforeEach(() => {
        // Reset mocks
        vi.clearAllMocks();
        lastMockDriver = null;
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should query server status successfully', async () => {
        browser = new ServerBrowser();
        const queryPromise = browser.queryServerInfo('localhost', 27910);

        // driver should have been created
        expect(lastMockDriver).not.toBeNull();
        const driverInstance = lastMockDriver!;

        // Wait for next tick to let connect promise resolve
        await new Promise(resolve => setTimeout(resolve, 0));

        // Now verify send was called
        expect(driverInstance.sendSpy).toHaveBeenCalled();

        // Simulate server response
        const responseText = `map: q2dm1\nplayers: 5 active (16 max)\nnum score ping name\n`;

        const writer = new BinaryWriter();
        writer.writeByte(ServerCommand.print);
        writer.writeByte(2); // Level
        writer.writeString(responseText);

        const netchan = new NetChan();
        const responsePacket = netchan.transmit(writer.getData());

        driverInstance.receiveMessage(responsePacket);

        const info = await queryPromise;

        expect(info).toBeDefined();
        expect(info.mapName).toBe('q2dm1');
        expect(info.playerCount).toBe(5);
        expect(info.maxPlayers).toBe(16);
        expect(info.ping).toBeGreaterThanOrEqual(0);
    });

    it('should handle timeout', async () => {
        vi.useFakeTimers();

        browser = new ServerBrowser();
        const queryPromise = browser.queryServerInfo('localhost', 27910);

        // Suppress unhandled rejection by attaching a no-op handler immediately
        queryPromise.catch(() => {});

        // Advance time to trigger timeout
        await vi.advanceTimersByTimeAsync(6000);

        await expect(queryPromise).rejects.toThrow('Query timed out');

        vi.useRealTimers();
    });
});
