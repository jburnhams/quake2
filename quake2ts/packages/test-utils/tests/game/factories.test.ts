import { describe, it, expect } from 'vitest';
import {
    createEntityFactory,
    createPlayerEntityFactory,
    createMonsterEntityFactory,
    createItemEntityFactory,
    createProjectileEntityFactory,
    createTriggerEntityFactory
} from '../../src/game/factories';
import { MoveType, Solid, ServerFlags } from '@quake2ts/game';

describe('Entity Factories', () => {
    describe('createEntityFactory', () => {
        it('should create defaults', () => {
            const ent = createEntityFactory();
            expect(ent.classname).toBe('info_null');
            expect(ent.movetype).toBe(MoveType.None);
        });

        it('should accept overrides', () => {
            const ent = createEntityFactory({ classname: 'custom' });
            expect(ent.classname).toBe('custom');
        });
    });

    describe('createPlayerEntityFactory', () => {
        it('should create player', () => {
            const ent = createPlayerEntityFactory();
            expect(ent.classname).toBe('player');
            expect(ent.health).toBe(100);
            expect(ent.svflags & ServerFlags.Player).toBeTruthy();
        });
    });

    describe('createMonsterEntityFactory', () => {
        it('should create monster', () => {
            const ent = createMonsterEntityFactory('monster_tank');
            expect(ent.classname).toBe('monster_tank');
            expect(ent.svflags & ServerFlags.Monster).toBeTruthy();
            expect(ent.movetype).toBe(MoveType.Step);
        });
    });

    describe('createItemEntityFactory', () => {
        it('should create item', () => {
            const ent = createItemEntityFactory('item_quad');
            expect(ent.classname).toBe('item_quad');
            expect(ent.solid).toBe(Solid.Trigger);
        });
    });

    describe('createProjectileEntityFactory', () => {
        it('should create projectile', () => {
            const ent = createProjectileEntityFactory('rocket');
            expect(ent.classname).toBe('rocket');
            expect(ent.svflags & ServerFlags.Projectile).toBeTruthy();
        });
    });

    describe('createTriggerEntityFactory', () => {
        it('should create trigger', () => {
            const ent = createTriggerEntityFactory('trigger_once');
            expect(ent.classname).toBe('trigger_once');
            expect(ent.solid).toBe(Solid.Trigger);
        });
    });
});
