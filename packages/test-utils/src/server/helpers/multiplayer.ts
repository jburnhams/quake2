import { Server, Client, ClientState, ServerState, ServerStatic } from '@quake2ts/server';
import { Entity } from '@quake2ts/game';
import { UserCommand } from '@quake2ts/shared';
import { createMockServerState } from '../mocks/state.js';
import { createMockServerClient } from '../mocks/state.js';
import { createMockUserInfo, serializeUserInfo, UserInfo } from '../mocks/connection.js';

// Define a type that combines Server and ServerStatic for convenience in tests
// since the real server implementation splits these but tests often need both.
export type MockServerContext = Server & {
    clients: (Client | null)[];
    entities?: Entity[];
};

export interface MultiplayerScenario {
    server: MockServerContext;
    clients: Client[];
    entities: Entity[];
}

/**
 * Creates a multiplayer test scenario with a mock server and a number of clients.
 * @param numPlayers Number of players to simulate.
 */
export function createMultiplayerTestScenario(numPlayers: number = 2): MultiplayerScenario {
    const baseServer = createMockServerState();
    const clients: Client[] = [];
    const entities: Entity[] = [];

    const server: MockServerContext = {
        ...baseServer,
        clients: new Array(numPlayers).fill(null),
        entities: []
    };

    for (let i = 0; i < numPlayers; i++) {
        // Create client
        const client = createMockServerClient(i, {
            state: ClientState.Active,
            userInfo: serializeUserInfo(createMockUserInfo({ name: `Player${i}` }))
        });

        // Create player entity
        const entity = {
            classname: 'player',
            s: { origin: { x: 0, y: 0, z: 0 }, number: i + 1 },
            client: client
        } as unknown as Entity;

        client.edict = entity;
        server.clients[i] = client;
        clients.push(client);
        entities.push(entity);
    }

    // Assign entities to server
    server.entities = entities;

    return {
        server,
        clients,
        entities
    };
}

/**
 * Simulates a player joining the server.
 * @param server The mock server instance.
 * @param userInfo Optional user info overrides.
 */
export async function simulatePlayerJoin(server: MockServerContext, userInfo?: Partial<UserInfo>): Promise<Client> {
    // Find free client slot
    const index = server.clients.findIndex((c) => !c || c.state === ClientState.Free);
    if (index === -1) {
        throw new Error('Server full');
    }

    const client = createMockServerClient(index, {
        state: ClientState.Connected,
        userInfo: serializeUserInfo(createMockUserInfo(userInfo))
    });

    server.clients[index] = client;

    // Simulate connection process
    client.state = ClientState.Active;

    // Create entity
    const entity = {
        classname: 'player',
        s: { origin: { x: 0, y: 0, z: 0 }, number: index + 1 },
        client: client
    } as unknown as Entity;
    client.edict = entity;

    // Add to entities list if possible (mock behavior)
    if (server.entities && Array.isArray(server.entities)) {
         // This is a simplified view, normally entities are in a fixed array
        (server.entities as Entity[])[index + 1] = entity;
    }

    return client;
}

/**
 * Simulates a player leaving the server.
 * @param server The mock server instance.
 * @param clientNum The client number to disconnect.
 */
export function simulatePlayerLeave(server: MockServerContext, clientNum: number): void {
    const client = server.clients[clientNum];
    if (client) {
        client.state = ClientState.Free;
        client.edict = null;
    }
}

/**
 * Simulates a single server frame update.
 * @param server The mock server instance.
 * @param deltaTime Time step in seconds (default: 0.1).
 */
export function simulateServerTick(server: MockServerContext, deltaTime: number = 0.1): void {
    server.time += deltaTime;
    server.frame++;
    // In a real server, we would call RunFrame, Physics, etc.
    // For mocks, we might just update client lastCmd times

    server.clients.forEach((client: Client | null) => {
        if (client && client.state === ClientState.Active) {
            // Update client logic if needed
        }
    });
}

/**
 * Simulates player input for a specific client.
 * @param client The server client.
 * @param input The input command.
 */
export function simulatePlayerInput(client: Client, input: Partial<UserCommand>): void {
    const cmd: UserCommand = {
        msec: 100,
        buttons: 0,
        angles: { x: 0, y: 0, z: 0 },
        forwardmove: 0,
        sidemove: 0,
        upmove: 0,
        sequence: client.lastCmd.sequence + 1,
        lightlevel: 0,
        impulse: 0,
        ...input
    };

    client.lastCmd = cmd;
    client.commandQueue.push(cmd);
    client.commandCount++;
}
