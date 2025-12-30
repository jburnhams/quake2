import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { queryMasterServer } from '@quake2ts/client/net/master.js';

describe('queryMasterServer', () => {
  // Mock global fetch
  const originalFetch = global.fetch;
  const mockFetch = vi.fn();

  beforeEach(() => {
    global.fetch = mockFetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.clearAllMocks();
  });

  it('should query the master server and return parsed server info', async () => {
    const mockResponse = [
      {
        address: 'ws://server1.com:27910',
        info: {
          hostname: 'Quake 2 Server 1',
          mapname: 'q2dm1',
          clients: '5',
          maxclients: '16',
          gamename: 'baseq2'
        }
      },
      {
        address: 'server2.com:27910', // Should auto-prefix ws://
        info: {
          hostname: 'Quake 2 Server 2',
          mapname: 'q2dm2',
          clients: '10',
          maxclients: '32',
          gamename: 'ctf'
        }
      }
    ];

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockResponse
    } as Response);

    const servers = await queryMasterServer('http://master.quake2ts.com');

    expect(mockFetch).toHaveBeenCalledWith('http://master.quake2ts.com');
    expect(servers).toHaveLength(2);

    expect(servers[0]).toEqual({
      name: 'Quake 2 Server 1',
      address: 'ws://server1.com:27910',
      map: 'q2dm1',
      players: 5,
      maxPlayers: 16,
      gamemode: 'baseq2',
      ping: undefined
    });

    expect(servers[1]).toEqual({
      name: 'Quake 2 Server 2',
      address: 'ws://server2.com:27910',
      map: 'q2dm2',
      players: 10,
      maxPlayers: 32,
      gamemode: 'ctf',
      ping: undefined
    });
  });

  it('should handle fetch errors gracefully', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error'
    } as Response);

    const servers = await queryMasterServer('http://master.quake2ts.com');
    expect(servers).toEqual([]);
  });

  it('should handle invalid JSON response', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ error: 'invalid format' }) // Not an array
    } as Response);

    const servers = await queryMasterServer('http://master.quake2ts.com');
    expect(servers).toEqual([]);
  });

  it('should handle network errors', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));

    const servers = await queryMasterServer('http://master.quake2ts.com');
    expect(servers).toEqual([]);
  });
});
