import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createGame, GameExports } from '../../src/index.js';
import { Entity, MoveType, Solid } from '../../src/entities/entity.js';
import { createTestContext } from '../test-helpers.js';
import type { GameImports } from '../../src/index.js';

describe('Spectator Mode', () => {
    let game: GameExports;
    let player: Entity;
    let entities: any;

    beforeEach(() => {
        const { entities: mockEntities } = createTestContext();
        const engine = mockEntities.engine;
        const imports: Partial<GameImports> = {
            trace: vi.fn(),
            pointcontents: vi.fn(),
        };
        const options = { gravity: { x: 0, y: 0, z: -800 } };
        game = createGame(imports, engine, options);
        entities = game.entities;

        // Mock player
        player = new Entity(1);
        player.classname = 'player';
        player.client = {} as any;
        player.movetype = MoveType.Walk;
        player.solid = Solid.BoundingBox;

        vi.spyOn(entities, 'find').mockReturnValue(player);
    });

    it('should set spectator mode', () => {
        game.setSpectator(0, true);

        expect(player.movetype).toBe(MoveType.Noclip);
        expect(player.solid).toBe(Solid.Not);
        expect(player.modelindex).toBe(0);
        expect(player.client?.pm_type).toBe(1); // PM_SPECTATOR
    });

    it('should unset spectator mode', () => {
        // First set
        game.setSpectator(0, true);
        // Then unset
        game.setSpectator(0, false);

        expect(player.movetype).toBe(MoveType.Walk);
        expect(player.solid).toBe(Solid.BoundingBox);
        expect(player.client?.pm_type).toBe(0); // PM_NORMAL
    });
});
