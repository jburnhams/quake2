
import { describe, it, expect } from 'vitest';
import { createClient, ClientState } from '../src/client.js';
import { UPDATE_BACKUP } from '@quake2ts/shared';

// Mock NetDriver
const mockNetDriver = {
    attach: () => {},
    onMessage: () => {},
    onClose: () => {},
    send: () => {},
    disconnect: () => {}
};

describe('Server State Structures', () => {
    it('Client initialization should set default values correctly', () => {
        const client = createClient(0, mockNetDriver as any);

        expect(client.index).toBe(0);
        expect(client.state).toBe(ClientState.Connected);
        expect(client.frames.length).toBe(UPDATE_BACKUP);
        expect(client.rate).toBe(25000);
        expect(client.lastCmd.msec).toBe(0);
    });
});
