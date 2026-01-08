
import { describe, it, expect } from 'vitest';
import { ClientState } from '../../src/client.js';
import { UPDATE_BACKUP } from '@quake2ts/shared';
import { createMockServerClient } from '@quake2ts/test-utils';

describe('Server State Structures', () => {
    it('Client initialization should set default values correctly', () => {
        const client = createMockServerClient(0);

        expect(client.index).toBe(0);
        expect(client.state).toBe(ClientState.Connected);
        expect(client.frames.length).toBe(0); // Mock client has empty frames by default in test-utils factory unless overridden
        expect(client.rate).toBe(0); // Mock client default
        expect(client.lastCmd.msec).toBe(0);
    });
});
