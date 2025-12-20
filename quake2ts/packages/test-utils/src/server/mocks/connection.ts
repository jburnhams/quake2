import { Client, ClientState } from '@quake2ts/server';
import { createMockServerClient } from './state.js';

/**
 * Interface representing connection state for testing.
 */
export interface Connection {
    state: ClientState;
    address: string;
    challenge: number;
    userInfo: UserInfo;
}

/**
 * Stages of the client connection handshake.
 */
export enum HandshakeStage {
    None = 0,
    Challenge = 1,
    Connect = 2,
    Info = 3,
    Active = 4
}

/**
 * Interface representing a handshake state.
 */
export interface Handshake {
    stage: HandshakeStage;
    clientNum: number;
    challenge: number;
    qport: number;
}

/**
 * Interface for UserInfo structure.
 */
export interface UserInfo {
    name: string;
    skin: string;
    model: string;
    fov: number;
    hand: number;
    rate: number;
    msg: number;
    spectator?: number;
    [key: string]: string | number | undefined;
}

/**
 * Helper to serialize UserInfo to Quake 2 info string format.
 * Format: \key\value\key2\value2
 */
export function serializeUserInfo(info: UserInfo): string {
    return Object.entries(info).reduce((acc, [key, value]) => {
        if (value !== undefined) {
            return `${acc}\\${key}\\${value}`;
        }
        return acc;
    }, '');
}

/**
 * Creates a mock UserInfo object.
 * @param overrides Optional overrides for the user info.
 */
export function createMockUserInfo(overrides?: Partial<UserInfo>): UserInfo {
    return {
        name: 'Player',
        skin: 'male/grunt',
        model: 'male/grunt',
        fov: 90,
        hand: 0,
        rate: 25000,
        msg: 1,
        ...overrides
    };
}

/**
 * Creates a mock connection object (Client) with specific state.
 * @param state The client state (default: Connected).
 * @param overrides Optional overrides for the client.
 */
export function createMockConnection(state: ClientState = ClientState.Connected, overrides?: Partial<Client>): Client {
    return createMockServerClient(0, {
        state,
        userInfo: serializeUserInfo(createMockUserInfo()),
        challenge: Math.floor(Math.random() * 100000),
        ...overrides
    });
}

/**
 * Creates a mock handshake object.
 * @param stage The stage of the handshake (default: None).
 */
export function createMockHandshake(stage: HandshakeStage = HandshakeStage.None): Handshake {
    return {
        stage,
        clientNum: -1,
        challenge: 0,
        qport: Math.floor(Math.random() * 65536)
    };
}

/**
 * Simulates a handshake between a mock client and server.
 * Note: This is a high-level simulation helper.
 * @param client The mock client connection.
 * @param server The mock server instance.
 * @returns Promise that resolves to true if handshake succeeded.
 */
export async function simulateHandshake(client: Client, server: any): Promise<boolean> {
    // 1. Get Challenge
    // In a real scenario, client sends getchallenge, server responds with challenge
    const challenge = Math.floor(Math.random() * 100000);
    client.challenge = challenge;

    // 2. Connect
    // Client sends connect command with qport, challenge, userinfo
    // Server assigns client slot
    if (server && server.clients) {
         // rudimentary check if server has space
    }

    // 3. Update state to Connected
    client.state = ClientState.Connected;

    // 4. Send configstrings (usually handled by server)

    // 5. Client enters game (prespawn)
    // Server sends stuff

    // 6. Client ready
    client.state = ClientState.Active;

    return true;
}
