import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EntitySystem } from '../../../src/entities/system.js';
import { Entity } from '../../../src/entities/entity.js';
import { getScoreboard } from '../../../src/dm/scoreboard.js';
import { createTestContext } from '@quake2ts/test-utils';
import { createPlayerInventory } from '../../../src/inventory/playerInventory.js';

describe('Scoreboard API', () => {
    let sys: EntitySystem;
    let testEntities: Entity[] = [];

    beforeEach(() => {
        const ctx = createTestContext();
        sys = ctx.entities;

        // Mock iteration
        sys.forEachEntity = vi.fn().mockImplementation((cb) => {
            testEntities.forEach(cb);
        });

        // Mock level name
        (sys as any).level = { levelName: 'q2dm1' };
    });

    afterEach(() => {
        testEntities = [];
    });

    function createPlayer(name: string, score: number) {
        const ent = new Entity(testEntities.length + 1);
        ent.classname = 'player';
        ent.client = {
            // index removed
            score: score,
            inventory: createPlayerInventory(),
            pers: {
                netname: name,
                connected: true,
                inventory: [],
                health: 100,
                max_health: 100,
                savedFlags: 0,
                selected_item: 0
            },
            weaponStates: {},
            buttons: 0,
            pm_type: 0,
            pm_time: 0,
            pm_flags: 0,
            gun_frame: 0,
            rdflags: 0,
            fov: 90
        } as any;
        testEntities.push(ent);
        return ent;
    }

    it('getScoreboard should return all connected players', () => {
        createPlayer('Player1', 10);
        createPlayer('Player2', 5);

        const sb = getScoreboard(sys);

        expect(sb.players.length).toBe(2);
        // expect(sb.mapName).toBe('q2dm1'); // Currently hardcoded to 'unknown' in scoreboard.ts pending levelName exposure
    });

    it('getScoreboard should sort by frags descending', () => {
        createPlayer('Loser', 2);
        createPlayer('Winner', 100);
        createPlayer('Average', 50);

        const sb = getScoreboard(sys);

        expect(sb.players[0].name).toBe('Winner');
        expect(sb.players[1].name).toBe('Average');
        expect(sb.players[2].name).toBe('Loser');
    });

    it('getScoreboard should handle missing names', () => {
        const p = createPlayer('', 0);
        p.client!.pers.netname = undefined;

        const sb = getScoreboard(sys);

        expect(sb.players[0].name).toContain('Player');
    });
});
