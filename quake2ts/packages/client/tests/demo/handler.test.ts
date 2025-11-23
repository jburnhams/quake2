import { describe, it, expect } from 'vitest';
import { ClientNetworkHandler } from '../../src/demo/handler.js';
import { DEMO_ITEM_MAPPING } from '../../src/demo/itemMapping.js';
import { WeaponId, PowerupId, AmmoType } from '@quake2ts/game';
import { FrameData, createEmptyProtocolPlayerState } from '@quake2ts/engine';

describe('ClientNetworkHandler', () => {
    it('should map inventory array to PlayerInventory correctly', () => {
        const handler = new ClientNetworkHandler();

        // Mock frame data
        const frame: FrameData = {
            serverFrame: 1,
            deltaFrame: 0,
            surpressCount: 0,
            areaBytes: 0,
            areaBits: new Uint8Array(),
            playerState: createEmptyProtocolPlayerState(),
            packetEntities: { delta: false, entities: [] }
        };
        handler.onFrame(frame);

        // Create a mock inventory array
        const inventory = new Array(256).fill(0);

        // Find indices for specific items
        const blasterIndex = DEMO_ITEM_MAPPING.findIndex(m => m.type === 'weapon' && m.id === WeaponId.Blaster);
        const shellsIndex = DEMO_ITEM_MAPPING.findIndex(m => m.type === 'ammo' && m.id === AmmoType.Shells);
        const quadIndex = DEMO_ITEM_MAPPING.findIndex(m => m.type === 'powerup' && m.id === PowerupId.QuadDamage);

        // Set values
        if (blasterIndex !== -1) inventory[blasterIndex] = 1;
        if (shellsIndex !== -1) inventory[shellsIndex] = 50;
        if (quadIndex !== -1) inventory[quadIndex] = 300; // 30 seconds (10Hz)

        handler.onInventory(inventory);

        const state = handler.getPredictionState();
        const clientInventory = state.client!.inventory;

        expect(clientInventory.ownedWeapons.has(WeaponId.Blaster)).toBe(true);
        expect(clientInventory.ammo.counts[AmmoType.Shells]).toBe(50);
        expect(clientInventory.powerups.get(PowerupId.QuadDamage)).toBe(300);
    });
});
