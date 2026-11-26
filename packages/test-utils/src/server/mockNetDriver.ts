import { NetDriver } from '@quake2ts/shared';
import { vi, type Mock } from 'vitest';
import { LegacyMock, legacyFn } from '../vitest-compat.js';

export interface MockNetDriverState {
    connected: boolean;
    messagesSent: Uint8Array[];
    messageHandlers: ((data: Uint8Array) => void)[];
    closeHandlers: (() => void)[];
    errorHandlers: ((err: Error) => void)[];
}

/**
 * A mock implementation of NetDriver that provides testing hooks.
 * Unlike the simple createMockNetDriver factory, this class maintains state
 * and allows for stimulating events (receiving messages, triggering errors).
 */
export class MockNetDriver implements NetDriver {
    public state: MockNetDriverState = {
        connected: false,
        messagesSent: [],
        messageHandlers: [],
        closeHandlers: [],
        errorHandlers: []
    };

    public connectSpy: LegacyMock<[string], Promise<void>> = legacyFn(async (url: string) => {
        this.state.connected = true;
    });

    public disconnectSpy: LegacyMock<[], void> = legacyFn(() => {
        this.state.connected = false;
        this.state.closeHandlers.forEach(h => h());
    });

    public sendSpy: LegacyMock<[Uint8Array], void> = legacyFn((data: Uint8Array) => {
        this.state.messagesSent.push(new Uint8Array(data));
    });

    public connect(url: string): Promise<void> {
        return this.connectSpy(url);
    }

    public disconnect(): void {
        this.disconnectSpy();
    }

    public send(data: Uint8Array): void {
        this.sendSpy(data);
    }

    public onMessage(cb: (data: Uint8Array) => void): void {
        this.state.messageHandlers.push(cb);
    }

    public onClose(cb: () => void): void {
        this.state.closeHandlers.push(cb);
    }

    public onError(cb: (err: Error) => void): void {
        this.state.errorHandlers.push(cb);
    }

    public isConnected(): boolean {
        return this.state.connected;
    }

    // --- Test Helpers ---

    /**
     * Simulate receiving a message from the network.
     */
    public receiveMessage(data: Uint8Array): void {
        this.state.messageHandlers.forEach(h => h(data));
    }

    /**
     * Simulate a connection close event from the remote side.
     */
    public simulateClose(): void {
        this.state.connected = false;
        this.state.closeHandlers.forEach(h => h());
    }

    /**
     * Simulate a connection error.
     */
    public simulateError(err: Error): void {
        this.state.errorHandlers.forEach(h => h(err));
    }

    /**
     * Get the last sent message.
     */
    public getLastSentMessage(): Uint8Array | undefined {
        return this.state.messagesSent.length > 0
            ? this.state.messagesSent[this.state.messagesSent.length - 1]
            : undefined;
    }

    /**
     * Clear recorded sent messages.
     */
    public clearSentMessages(): void {
        this.state.messagesSent = [];
    }
}
