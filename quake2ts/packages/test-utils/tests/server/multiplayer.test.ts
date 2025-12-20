import { describe, it, expect } from 'vitest';
import {
    createMultiplayerTestScenario,
    simulatePlayerJoin,
    simulatePlayerLeave,
    simulateServerTick,
    simulatePlayerInput
} from '../../src/server/helpers/multiplayer';
import { ClientState } from '@quake2ts/server';

describe('Multiplayer Helpers', () => {
    describe('createMultiplayerTestScenario', () => {
        it('should create a scenario with specified number of players', () => {
            const scenario = createMultiplayerTestScenario(3);
            expect(scenario.clients.length).toBe(3);
            expect(scenario.entities.length).toBe(3);
            expect(scenario.server.clients.length).toBe(3);

            // Verify clients are active
            scenario.clients.forEach(client => {
                expect(client.state).toBe(ClientState.Active);
                expect(client.edict).toBeDefined();
            });
        });
    });

    describe('simulatePlayerJoin', () => {
        it('should add a player to the server', async () => {
            const scenario = createMultiplayerTestScenario(1);
            // Expand server capacity manually for test
            scenario.server.clients = [...scenario.server.clients, null];

            const client = await simulatePlayerJoin(scenario.server, { name: 'NewPlayer' });

            expect(client).toBeDefined();
            expect(client.state).toBe(ClientState.Active);
            expect(client.userInfo).toContain('NewPlayer');
            expect(scenario.server.clients[1]).toBe(client);
        });

        it('should throw if server is full', async () => {
            const scenario = createMultiplayerTestScenario(2);
            // No null slots
            await expect(simulatePlayerJoin(scenario.server)).rejects.toThrow('Server full');
        });
    });

    describe('simulatePlayerLeave', () => {
        it('should set client state to Free', () => {
            const scenario = createMultiplayerTestScenario(1);
            const client = scenario.clients[0];

            simulatePlayerLeave(scenario.server, 0);

            expect(client.state).toBe(ClientState.Free);
            expect(client.edict).toBeNull();
        });
    });

    describe('simulateServerTick', () => {
        it('should advance server time and frame', () => {
            const scenario = createMultiplayerTestScenario(1);
            const initialTime = scenario.server.time;
            const initialFrame = scenario.server.frame;

            simulateServerTick(scenario.server, 0.1);

            expect(scenario.server.time).toBeCloseTo(initialTime + 0.1);
            expect(scenario.server.frame).toBe(initialFrame + 1);
        });
    });

    describe('simulatePlayerInput', () => {
        it('should update client lastCmd and queue', () => {
            const scenario = createMultiplayerTestScenario(1);
            const client = scenario.clients[0];
            const initialSequence = client.lastCmd.sequence;

            simulatePlayerInput(client, { forwardmove: 100 });

            expect(client.lastCmd.forwardmove).toBe(100);
            expect(client.lastCmd.sequence).toBe(initialSequence + 1);
            expect(client.commandQueue.length).toBeGreaterThan(0);
        });
    });
});
