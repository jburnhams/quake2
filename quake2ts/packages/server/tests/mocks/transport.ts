import { NetworkTransport } from '../../src/transport.js';
import { NetDriver } from '@quake2ts/shared';
import { vi } from 'vitest';

export class MockTransport implements NetworkTransport {
    public onConnectionCallback?: (driver: NetDriver, info?: any) => void;
    public onErrorCallback?: (error: Error) => void;

    public listenSpy = vi.fn().mockResolvedValue(undefined);
    public closeSpy = vi.fn();

    async listen(port: number): Promise<void> {
        return this.listenSpy(port);
    }

    close() {
        this.closeSpy();
    }

    onConnection(callback: (driver: NetDriver, info?: any) => void) {
        this.onConnectionCallback = callback;
    }

    onError(callback: (error: Error) => void) {
        this.onErrorCallback = callback;
    }

    // Helper to simulate connection
    public simulateConnection(driver: NetDriver, info?: any) {
        if (this.onConnectionCallback) {
            this.onConnectionCallback(driver, info);
        }
    }
}
