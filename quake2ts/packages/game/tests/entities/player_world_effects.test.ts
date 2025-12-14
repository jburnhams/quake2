
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Entity, MoveType } from '../../src/entities/entity.js';
import { player_think } from '../../src/entities/player.js';
import { EntitySystem } from '../../src/entities/system.js';
import { PlayerClient } from '../../src/inventory/playerInventory.js';

// Mock T_Damage to avoid importing the real one which might have issues in isolation or deep deps
vi.mock('../../src/combat/damage.js', () => ({
  T_Damage: vi.fn(),
  Damageable: {},
}));

describe('P_WorldEffects via player_think', () => {
    let sys: EntitySystem;
    let player: Entity;

    beforeEach(() => {
        sys = {
            timeSeconds: 10,
            sound: vi.fn(),
            scheduleThink: vi.fn(),
            game: {
                respawn: vi.fn()
            }
        } as unknown as EntitySystem;

        player = new Entity(1);
        player.classname = 'player';
        player.client = {
            inventory: {
                powerups: new Map()
            },
            air_finished: 0,
            breather_time: 0,
            enviro_time: 0,
            waterlevel: 0,
            // Mock other needed fields
            buttons: 0,
            weaponstate: 0,
        } as unknown as PlayerClient;
        player.waterlevel = 0;
        player.watertype = 0;
        player.damage_debounce_time = 0;
        player.health = 100;
        player.takedamage = true;
        player.deadflag = 0; // Alive
    });

    it('should set air_finished when not underwater', () => {
        player.waterlevel = 0;
        player_think(player, sys);
        expect(player.client?.air_finished).toBe(sys.timeSeconds + 12);
    });

    it('should set air_finished when underwater but with breather', () => {
        player.waterlevel = 3;
        player.client!.breather_time = sys.timeSeconds + 10;
        player_think(player, sys);
        // Should be + 9
        expect(player.client?.air_finished).toBe(sys.timeSeconds + 9);
    });

    it('should set air_finished when underwater but with enviro suit', () => {
        player.waterlevel = 3;
        player.client!.enviro_time = sys.timeSeconds + 10;
        player_think(player, sys);
        expect(player.client?.air_finished).toBe(sys.timeSeconds + 9);
    });
});
