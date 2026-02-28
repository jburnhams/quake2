import { describe, it, expect, vi } from 'vitest';
import { createClient, ClientState } from '../../src/client.js';
import { NetChan } from '@quake2ts/shared';
import { createMockNetDriver } from '@quake2ts/test-utils';

describe('Server Client', () => {
    it('should initialize with NetChan', () => {
        const mockNetDriver = createMockNetDriver();

        const client = createClient(0, mockNetDriver);

        expect(client).toBeDefined();
        expect(client.netchan).toBeDefined();
        expect(client.netchan).toBeInstanceOf(NetChan);
        expect(client.state).toBe(ClientState.Connected);

        // Verify qport is set (it's random, but should be a number)
        expect(typeof client.netchan.qport).toBe('number');
    });
});
