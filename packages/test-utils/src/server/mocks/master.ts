import { Client } from '@quake2ts/server';

export interface MasterServer {
  registerServer(info: ServerInfo): Promise<boolean>;
  heartbeat(serverAddress: string): Promise<boolean>;
  getServerList(filter?: ServerListFilter): Promise<ServerInfo[]>;
}

export interface ServerInfo {
  address: string;
  name: string;
  map: string;
  players: number;
  maxPlayers: number;
  gametype: string;
  version: string;
  password?: boolean;
}

export interface ServerListFilter {
  gametype?: string;
  map?: string;
  notEmpty?: boolean;
  notFull?: boolean;
}

/**
 * Creates a mock master server for testing server registration and browsing
 * @param overrides - Optional overrides for the master server behavior
 */
export function createMockMasterServer(overrides: Partial<MasterServer> = {}): MasterServer {
  const servers = new Map<string, ServerInfo>();

  return {
    registerServer: async (info: ServerInfo): Promise<boolean> => {
      servers.set(info.address, info);
      return true;
    },
    heartbeat: async (serverAddress: string): Promise<boolean> => {
      return servers.has(serverAddress);
    },
    getServerList: async (filter?: ServerListFilter): Promise<ServerInfo[]> => {
      let list = Array.from(servers.values());

      if (filter) {
        if (filter.gametype) {
          list = list.filter(s => s.gametype === filter.gametype);
        }
        if (filter.map) {
          list = list.filter(s => s.map === filter.map);
        }
        if (filter.notEmpty) {
          list = list.filter(s => s.players > 0);
        }
        if (filter.notFull) {
          list = list.filter(s => s.players < s.maxPlayers);
        }
      }

      return list;
    },
    ...overrides
  };
}

/**
 * Creates a mock server info object
 * @param overrides - Optional overrides
 */
export function createMockServerInfo(overrides: Partial<ServerInfo> = {}): ServerInfo {
  return {
    address: '127.0.0.1:27910',
    name: 'Quake 2 Test Server',
    map: 'q2dm1',
    players: 0,
    maxPlayers: 16,
    gametype: 'deathmatch',
    version: '1.0',
    ...overrides
  };
}

/**
 * Simulates the process of a game server registering with the master server
 * @param server - The mock game server instance (typed as any to accept mock)
 * @param master - The mock master server
 */
export async function simulateServerRegistration(server: any, master: MasterServer): Promise<boolean> {
  const info = createMockServerInfo({
    name: server.name || 'Test Server',
    map: server.mapName || 'q2dm1',
    players: server.clients ? server.clients.filter((c: Client | null) => c && c.state >= 2).length : 0,
    maxPlayers: server.maxClients || 16
  });

  return master.registerServer(info);
}
