import { describe, it, expect } from 'vitest';
import { DEMO_ITEM_MAPPING } from '../../src/demo/itemMapping.js';
import { WeaponId, PowerupId, AmmoType } from '@quake2ts/game';

describe('Item Mapping', () => {
    it('should have correct mapping for known items', () => {
        // Index 7: IT_WEAPON_GRAPPLE
        expect(DEMO_ITEM_MAPPING[7]).toEqual({ type: 'weapon', id: WeaponId.Grapple });

        // Index 8: IT_WEAPON_BLASTER
        expect(DEMO_ITEM_MAPPING[8]).toEqual({ type: 'weapon', id: WeaponId.Blaster });

        // Index 9: IT_WEAPON_CHAINFIST
        expect(DEMO_ITEM_MAPPING[9]).toEqual({ type: 'weapon', id: WeaponId.ChainFist });

        // Index 11: IT_WEAPON_SSHOTGUN
        expect(DEMO_ITEM_MAPPING[11]).toEqual({ type: 'weapon', id: WeaponId.SuperShotgun });
    });

    it('should map ammo correctly', () => {
        // IT_AMMO_SHELLS
        const shellMapping = DEMO_ITEM_MAPPING.find(m => m.type === 'ammo' && m.id === AmmoType.Shells);
        expect(shellMapping).toBeDefined();
    });

    it('should map powerups correctly', () => {
        // IT_ITEM_QUAD
        const quadMapping = DEMO_ITEM_MAPPING.find(m => m.type === 'powerup' && m.id === PowerupId.QuadDamage);
        expect(quadMapping).toBeDefined();
    });
});
