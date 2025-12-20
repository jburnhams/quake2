import { describe, it, expect, vi } from 'vitest';
import {
    createMockConnection,
    createMockHandshake,
    simulateHandshake,
    createMockUserInfo,
    serializeUserInfo,
    HandshakeStage
} from '../../src/server/mocks/connection';
import { ClientState } from '@quake2ts/server';

describe('Server Mocks: Connection', () => {
    describe('createMockUserInfo', () => {
        it('should create default user info', () => {
            const info = createMockUserInfo();
            expect(info.name).toBe('Player');
            expect(info.skin).toBe('male/grunt');
            expect(info.rate).toBe(25000);
        });

        it('should allow overrides', () => {
            const info = createMockUserInfo({ name: 'TestPlayer', fov: 110 });
            expect(info.name).toBe('TestPlayer');
            expect(info.fov).toBe(110);
        });
    });

    describe('serializeUserInfo', () => {
        it('should serialize user info to Q2 format', () => {
            const info = { name: 'Player', skin: 'base' };
            const serialized = serializeUserInfo(info as any);
            expect(serialized).toBe('\\name\\Player\\skin\\base');
        });
    });

    describe('createMockConnection', () => {
        it('should create a mock client with default state', () => {
            const client = createMockConnection();
            expect(client.state).toBe(ClientState.Connected);
            expect(client.userInfo).toContain('Player');
        });

        it('should allow overrides', () => {
            const client = createMockConnection(ClientState.Active, { name: 'Custom' });
            expect(client.state).toBe(ClientState.Active);
            expect(client.name).toBe('Custom');
        });
    });

    describe('createMockHandshake', () => {
        it('should create default handshake', () => {
            const handshake = createMockHandshake();
            expect(handshake.stage).toBe(HandshakeStage.None);
            expect(handshake.clientNum).toBe(-1);
        });
    });

    describe('simulateHandshake', () => {
        it('should transition client to Active state', async () => {
            const client = createMockConnection(ClientState.Free);
            const server = {};
            const result = await simulateHandshake(client, server);

            expect(result).toBe(true);
            expect(client.state).toBe(ClientState.Active);
            expect(client.challenge).toBeGreaterThan(0);
        });
    });
});
