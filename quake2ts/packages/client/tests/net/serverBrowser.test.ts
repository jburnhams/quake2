import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ServerBrowser } from '../../src/net/serverBrowser';
import { DedicatedServer } from '@quake2ts/server';
import { NetDriver, BinaryWriter, ServerCommand, NetChan } from '@quake2ts/shared';
import { MockNetDriver } from '@quake2ts/test-utils';
import { BrowserWebSocketNetDriver } from '../../src/net/browserWsDriver';

// We can mock the module '../src/net/browserWsDriver.js' to return our MockNetDriver.
vi.mock('../../src/net/browserWsDriver.js');

describe('ServerBrowser', () => {
    let browser: ServerBrowser;

    beforeEach(() => {
        // Reset mocks
        vi.clearAllMocks();
    });

    it('should query server status successfully', async () => {
        let driverInstance: MockNetDriver | null = null;

        // Use standard import now that we mocked it
        (BrowserWebSocketNetDriver as any).mockImplementation(() => {
            driverInstance = new MockNetDriver();
            // Spy on send to simulate server response
            vi.spyOn(driverInstance, 'send').mockImplementation((data) => {
                // Simulate server response after receiving 'status' command
                const responseText = `map: q2dm1\nplayers: 5 active (16 max)\nnum score ping name\n`;

                const writer = new BinaryWriter();
                writer.writeByte(ServerCommand.print);
                writer.writeByte(2); // Level
                writer.writeString(responseText);

                const netchan = new NetChan();
                const responsePacket = netchan.transmit(writer.getData());

                // Trigger message back to client (async to simulate network)
                setTimeout(() => {
                    driverInstance?.receiveMessage(responsePacket);
                }, 5);
            });
            return driverInstance;
        });

        browser = new ServerBrowser();
        const queryPromise = browser.queryServerInfo('localhost', 27910);

        const info = await queryPromise;

        expect(info).toBeDefined();
        expect(info.mapName).toBe('q2dm1');
        expect(info.playerCount).toBe(5);
        expect(info.maxPlayers).toBe(16);
        expect(info.ping).toBeGreaterThanOrEqual(0);
    });

    it('should handle timeout', async () => {
        (BrowserWebSocketNetDriver as any).mockImplementation(() => {
            const d = new MockNetDriver();
            vi.spyOn(d, 'send').mockImplementation(() => {
                // Do nothing
            });
            return d;
        });

        browser = new ServerBrowser();

        vi.useFakeTimers();
        const queryPromise = browser.queryServerInfo('localhost', 27910);
        vi.advanceTimersByTime(6000);

        await expect(queryPromise).rejects.toThrow('Query timed out');

        vi.useRealTimers();
    });
});
