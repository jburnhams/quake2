import { describe, it, expect, vi } from 'vitest';
import {
    createMockDamageInfo,
    createMockWeapon,
    mockMonsterAttacks
} from '../../../src/game/mocks/combat';
import { DamageMod } from '@quake2ts/game';

describe('Combat Mocks', () => {
    describe('createMockDamageInfo', () => {
        it('should create defaults', () => {
            const info = createMockDamageInfo();
            expect(info.damage).toBe(10);
            expect(info.mod).toBe(DamageMod.UNKNOWN);
        });

        it('should apply overrides', () => {
            const info = createMockDamageInfo({ damage: 50 });
            expect(info.damage).toBe(50);
        });
    });

    describe('createMockWeapon', () => {
        it('should create default weapon', () => {
            const w = createMockWeapon();
            expect(w.name).toBe('Mock Weapon');
            expect(w.think).toBeDefined();
        });

        it('should use known weapon definitions', () => {
            const w = createMockWeapon('weapon_railgun');
            expect(w.name).toBe('Railgun');
        });

        it('should use provided name if unknown', () => {
            const w = createMockWeapon('custom_weapon');
            expect(w.name).toBe('custom_weapon');
        });
    });

    describe('mockMonsterAttacks', () => {
        it('should have all attack mocks', () => {
            expect(mockMonsterAttacks.fireBlaster).toBeDefined();
            expect(mockMonsterAttacks.fireRocket).toBeDefined();
        });

        it('should be spies', () => {
            mockMonsterAttacks.fireBlaster({} as any, {x:0,y:0,z:0}, {x:0,y:0,z:0}, 10, 1000, 0);
            expect(mockMonsterAttacks.fireBlaster).toHaveBeenCalled();
        });
    });
});
