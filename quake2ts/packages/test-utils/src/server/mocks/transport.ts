import { NetworkTransport } from '@quake2ts/server';
import { NetDriver } from '@quake2ts/shared';
import { vi } from 'vitest';

/**
 * Mock implementation of the NetworkTransport interface for server testing.
 * Allows simulating connections and errors.
 */
export class MockTransport implements NetworkTransport {
    public onConnectionCallback?: (driver: NetDriver, info?: any) => void;
    public onErrorCallback?: (error: Error) => void;
    public address: string = '127.0.0.1';
    public port: number = 27910;
    public sentMessages: Uint8Array[] = [];
    public receivedMessages: Uint8Array[] = [];
    public listening: boolean = false;

    public listenSpy = vi.fn().mockImplementation(async (port: number) => {
        this.port = port;
        this.listening = true;
    });
    public closeSpy = vi.fn().mockImplementation(() => {
        this.listening = false;
    });

    /**
     * Start listening on the specified port.
     */
    async listen(port: number): Promise<void> {
        return this.listenSpy(port);
    }

    /**
     * Close the transport.
     */
    close() {
        this.closeSpy();
    }

    /**
     * Register a callback for new connections.
     */
    onConnection(callback: (driver: NetDriver, info?: any) => void) {
        this.onConnectionCallback = callback;
    }

    /**
     * Register a callback for errors.
     */
    onError(callback: (error: Error) => void) {
        this.onErrorCallback = callback;
    }

    /**
     * Check if the transport is currently listening.
     */
    public isListening(): boolean {
        return this.listening;
    }

    /**
     * Helper to simulate a new connection.
     * @param driver The network driver for the connection.
     * @param info Optional connection info.
     */
    public simulateConnection(driver: NetDriver, info?: any) {
        if (this.onConnectionCallback) {
            this.onConnectionCallback(driver, info);
        }
    }

    /**
     * Helper to simulate an error.
     * @param error The error to simulate.
     */
    public simulateError(error: Error) {
        if (this.onErrorCallback) {
            this.onErrorCallback(error);
        }
    }
}

/**
 * Interface for mock UDP socket.
 * This is a partial mock of Node.js dgram.Socket or similar.
 */
export interface MockUDPSocket {
    send: (msg: Uint8Array, offset: number, length: number, port: number, address: string, callback?: (error: Error | null, bytes: number) => void) => void;
    on: (event: string, callback: (...args: any[]) => void) => void;
    close: () => void;
    bind: (port: number, address?: string) => void;
    address: () => { address: string; family: string; port: number };
}

/**
 * Creates a mock UDP socket.
 * @param overrides Optional overrides for the socket methods.
 */
export function createMockUDPSocket(overrides?: Partial<MockUDPSocket>): MockUDPSocket {
    const socket: MockUDPSocket = {
        send: vi.fn(),
        on: vi.fn(),
        close: vi.fn(),
        bind: vi.fn(),
        address: vi.fn().mockReturnValue({ address: '127.0.0.1', family: 'IPv4', port: 0 }),
        ...overrides,
    };
    return socket;
}

/**
 * Interface for network address.
 */
export interface NetworkAddress {
    ip: string;
    port: number;
}

/**
 * Creates a mock network address.
 * @param ip IP address (default: '127.0.0.1')
 * @param port Port number (default: 27910)
 */
export function createMockNetworkAddress(ip: string = '127.0.0.1', port: number = 27910): NetworkAddress {
    return { ip, port };
}

/**
 * Creates a configured MockTransport instance.
 * @param address Address to bind to (default: '127.0.0.1')
 * @param port Port to listen on (default: 27910)
 * @param overrides Optional overrides for the transport properties.
 */
export function createMockTransport(
    address: string = '127.0.0.1',
    port: number = 27910,
    overrides?: Partial<MockTransport>
): MockTransport {
    const transport = new MockTransport();
    transport.address = address;
    transport.port = port;
    Object.assign(transport, overrides);
    return transport;
}
