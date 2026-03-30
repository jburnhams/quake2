import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createGame, GameExports } from '../../../src/index.js';
import { Entity, MoveType, Solid } from '../../../src/entities/entity.js';
import { createTestContext, createPlayerEntityFactory } from '@quake2ts/test-utils';
import type { GameImports } from '../../../src/index.js';
import { EntitySystem } from '../../../src/entities/system.js';

describe('Spectator Mode', () => {
    let game: GameExports;
    let player: Entity;
    let entities: EntitySystem;

    beforeEach(() => {
        const { entities: mockEntities } = createTestContext();
        const engine = mockEntities.engine;
        const imports: Partial<GameImports> = {
            trace: vi.fn(),
            pointcontents: vi.fn(),
        };
        const options = { gravity: { x: 0, y: 0, z: -800 } };
        game = createGame(imports, engine, options);
        entities = game.entities as EntitySystem;

        // Mock player using test-utils factory for type safety
        player = createPlayerEntityFactory({
            index: 1,
            classname: 'player',
            movetype: MoveType.Walk,
            solid: Solid.BoundingBox,
        }) as Entity;

        vi.spyOn(entities, 'find').mockReturnValue(player);
    });

    it('should set spectator mode', () => {
        game.setSpectator(0, true);

        expect(player.movetype).toBe(MoveType.Noclip);
        expect(player.solid).toBe(Solid.Not);
        expect(player.modelindex).toBe(0);
        expect(player.client?.pm_type).toBe(3); // PM_SPECTATOR (3 in this codebase)
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
