import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ServerBrowser } from '../../src/net/serverBrowser';
import { DedicatedServer } from '@quake2ts/server';
import { NetDriver, BinaryWriter, ServerCommand, NetChan } from '@quake2ts/shared';

// Mock Network classes
class MockNetDriver implements NetDriver {
    private onMessageCallback: (data: Uint8Array) => void = () => {};
    private onCloseCallback: () => void = () => {};
    private onErrorCallback: (err: Error) => void = () => {};

    connect(url: string): Promise<void> {
        return Promise.resolve();
    }
    disconnect(): void {
        this.onCloseCallback();
    }
    send(data: Uint8Array): void {
        // In real test we would capture this
    }
    onMessage(cb: (data: Uint8Array) => void): void {
        this.onMessageCallback = cb;
    }
    onClose(cb: () => void): void {
        this.onCloseCallback = cb;
    }
    onError(cb: (err: Error) => void): void {
        this.onErrorCallback = cb;
    }

    // Helpers for test
    triggerMessage(data: Uint8Array) {
        this.onMessageCallback(data);
    }
}

// Since we cannot easily start a full WebSocket server in JSDOM/Unit tests without async complexity and ports,
// we will verify the parser logic by mocking the driver behavior inside ServerBrowser or refactoring ServerBrowser
// to accept a driver factory.
//
// However, ServerBrowser instantiates BrowserWebSocketNetDriver internally.
// We can mock the module '../src/net/browserWsDriver.js' to return our MockNetDriver.

vi.mock('../../src/net/browserWsDriver.js', () => {
    return {
        BrowserWebSocketNetDriver: vi.fn().mockImplementation(() => {
            return new MockNetDriver();
        })
    };
});

describe('ServerBrowser', () => {
    let browser: ServerBrowser;
    let mockDriver: MockNetDriver;

    // We need to capture the instance created inside ServerBrowser
    // Since we mocked the constructor, we can't easily access the internal instance
    // unless we spy on the constructor return.

    beforeEach(() => {
        // Reset mocks
        vi.clearAllMocks();
    });

    it('should query server status successfully', async () => {
        // Setup logic to capture the driver instance
        // Because ServerBrowser creates a NEW driver inside queryServerInfo,
        // we need our mock to return a tracked instance.

        let driverInstance: MockNetDriver | null = null;

        const { BrowserWebSocketNetDriver } = await import('../../src/net/browserWsDriver.js');
        (BrowserWebSocketNetDriver as any).mockImplementation(() => {
            driverInstance = new MockNetDriver();
            // Spy on send to simulate server response
            vi.spyOn(driverInstance, 'send').mockImplementation((data) => {
                // Simulate server response after receiving 'status' command
                // The client sends a packet with 'stringcmd status'

                // We construct a fake response
                // Status response: print command with map info
                // Note: The print command format from server is: print (byte) level (byte) string (string)
                // But Q2 servers actually send: 'print\n' + actual text in the stringcmd/print packet?
                // Wait, ServerCommand.print is op 10.
                // It is followed by level (byte) and string (null-terminated).

                // The STATUS command response in Q2 is actually a print command containing the status text.
                // The text starts with `print\n` sometimes in OOB, but in-band it is just the text.
                // Our ServerBrowser implementation checks for `text.startsWith('map:')` after `print\n` check?
                // Let's verify parse logic:
                // if (text.startsWith('map:')) ...

                // So the text itself should start with map:
                const responseText = `map: q2dm1\nplayers: 5 active (16 max)\nnum score ping name\n`;

                const writer = new BinaryWriter();
                writer.writeByte(ServerCommand.print);
                writer.writeByte(2); // Level
                writer.writeString(responseText);

                const netchan = new NetChan();
                const responsePacket = netchan.transmit(writer.getData());

                // Trigger message back to client (async to simulate network)
                // Use a very short timeout to ensure it runs within test
                setTimeout(() => {
                    driverInstance?.triggerMessage(responsePacket);
                }, 5);
            });
            return driverInstance;
        });

        browser = new ServerBrowser();
        const queryPromise = browser.queryServerInfo('localhost', 27910);

        // Wait for promise to resolve, but don't assume immediate resolution
        // If we timeout, the test framework will catch it
        const info = await queryPromise;

        expect(info).toBeDefined();
        expect(info.mapName).toBe('q2dm1');
        expect(info.playerCount).toBe(5);
        expect(info.maxPlayers).toBe(16);
        expect(info.ping).toBeGreaterThanOrEqual(0);
    });

    it('should handle timeout', async () => {
        // Mock driver that never responds
        const { BrowserWebSocketNetDriver } = await import('../../src/net/browserWsDriver.js');
        (BrowserWebSocketNetDriver as any).mockImplementation(() => {
            const d = new MockNetDriver();
            vi.spyOn(d, 'send').mockImplementation(() => {
                // Do nothing
            });
            return d;
        });

        browser = new ServerBrowser();

        // We use a short timeout for test?
        // queryServerInfo has hardcoded 5000ms.
        // Using vi.useFakeTimers might be needed.
        vi.useFakeTimers();

        const queryPromise = browser.queryServerInfo('localhost', 27910);

        vi.advanceTimersByTime(6000);

        await expect(queryPromise).rejects.toThrow('Query timed out');

        vi.useRealTimers();
    });
});
