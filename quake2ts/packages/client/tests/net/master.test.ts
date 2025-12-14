import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { queryMasterServer } from '../../src/net/master.js';

describe('Master Server Client', () => {
    // Mock global fetch
    const fetchMock = vi.fn();

    beforeEach(() => {
        vi.stubGlobal('fetch', fetchMock);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should fetch and parse server list correctly', async () => {
        const mockResponse = [
            {
                address: 'ws://server1.com:1234',
                info: {
                    hostname: 'My Server',
                    mapname: 'q2dm1',
                    clients: '5',
                    maxclients: '16'
                }
            },
            {
                address: '1.2.3.4:27910', // Raw IP:Port
                info: {
                    hostname: 'Another Server',
                    mapname: 'base1',
                    clients: '0',
                    maxclients: '8'
                }
            }
        ];

        fetchMock.mockResolvedValue({
            ok: true,
            json: async () => mockResponse
        });

        const servers = await queryMasterServer('http://master.quake2ts.com');

        expect(fetchMock).toHaveBeenCalledWith('http://master.quake2ts.com');
        expect(servers).toHaveLength(2);

        expect(servers[0]).toEqual({
            name: 'My Server',
            address: 'ws://server1.com:1234',
            map: 'q2dm1',
            players: 5,
            maxPlayers: 16,
            gamemode: 'baseq2',
            ping: undefined
        });

        // Check protocol auto-prefixing
        expect(servers[1].address).toBe('ws://1.2.3.4:27910');
    });

    it('should handle fetch errors gracefully', async () => {
        fetchMock.mockResolvedValue({
            ok: false,
            status: 500,
            statusText: 'Internal Server Error'
        });

        const servers = await queryMasterServer('http://bad-master.com');
        expect(servers).toEqual([]);
    });

    it('should handle invalid JSON response', async () => {
        fetchMock.mockResolvedValue({
            ok: true,
            json: async () => ({ not: 'an array' })
        });

        const servers = await queryMasterServer('http://master.com');
        expect(servers).toEqual([]);
    });
});
