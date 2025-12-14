export interface ServerInfo {
  name: string;
  address: string; // WebSocket URL
  map: string;
  players: number;
  maxPlayers: number;
  gamemode: string;
  ping?: number;
}

/**
 * Query master server for list of active game servers
 *
 * Note: Quake 2 master servers typically use UDP.
 * This implementation assumes an HTTP-based master server or gateway
 * compatible with web clients (WebSocket addresses).
 *
 * Expected JSON response format from master:
 * [
 *   { "address": "ws://example.com:27910", "info": { "hostname": "Server", "mapname": "q2dm1", ... } }
 * ]
 *
 * Or a simple list of addresses if we query them individually.
 * For now, we'll assume a standard JSON structure.
 */
export async function queryMasterServer(masterUrl: string): Promise<ServerInfo[]> {
    try {
        const response = await fetch(masterUrl);
        if (!response.ok) {
            throw new Error(`Master server request failed: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();

        // Parse data
        if (!Array.isArray(data)) {
            throw new Error('Invalid master server response: expected array');
        }

        return data.map((entry: any) => {
            // Adapt to different possible formats
            const address = entry.address || entry.ip + ':' + entry.port;
            const info = entry.info || {};

            // Validate address protocol
            let wsAddress = address;
            if (!address.startsWith('ws://') && !address.startsWith('wss://')) {
                // If it looks like a domain, assume wss or ws based on current page?
                // Or maybe assume ws:// for now.
                wsAddress = `ws://${address}`;
            }

            return {
                name: info.hostname || entry.name || address,
                address: wsAddress,
                map: info.mapname || entry.map || 'unknown',
                players: parseInt(info.clients || entry.players || '0', 10),
                maxPlayers: parseInt(info.maxclients || entry.maxPlayers || '0', 10),
                gamemode: info.gamename || entry.gamemode || 'baseq2',
                ping: undefined // Ping is client-side latency, not server reported usually
            };
        });

    } catch (error) {
        console.error('Failed to query master server:', error);
        return [];
    }
}
