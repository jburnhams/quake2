import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EntitySystem } from '../../../src/entities/system.js';
import { Entity, EntityFlags, Solid } from '../../../src/entities/entity.js';
import { registerTriggerFlashlight } from '../../../src/entities/triggers/flashlight.js';
import { createTestContext } from '../../test-helpers.js';
import { RenderFx } from '@quake2ts/shared';
import { SpawnRegistry } from '../../../src/entities/spawn.js';

describe('trigger_flashlight', () => {
    let context: EntitySystem;
    let trigger: Entity;
    let player: Entity;
    let spawnRegistry: SpawnRegistry;

    beforeEach(async () => {
        const spawnContext = createTestContext();
        context = spawnContext.entities;

        // Mock SpawnRegistry
        spawnRegistry = {
            register: vi.fn(),
            spawn: vi.fn(),
        } as unknown as SpawnRegistry;

        // Register flashlight trigger
        registerTriggerFlashlight(spawnRegistry);

        // Get the registration callback
        const registerCall = (spawnRegistry.register as any).mock.calls.find((c: any) => c[0] === 'trigger_flashlight');
        expect(registerCall).toBeDefined();
        const spawnFunction = registerCall[1];

        // Create trigger
        trigger = context.spawn();
        trigger.classname = 'trigger_flashlight';
        trigger.style = 0; // Default: toggle

        // Invoke the registered spawn function
        spawnFunction(trigger, spawnContext);

        // Create player
        player = context.spawn();
        player.client = {} as any;
        player.flags = 0;
        player.renderfx = 0;
    });

    it('toggles flashlight on when touched', () => {
        player.flags = 0;
        trigger.touch!(trigger, player, null, null);

        expect(player.flags & EntityFlags.Flashlight).toBeTruthy();
        expect(player.renderfx & RenderFx.Flashlight).toBeTruthy();
        expect(context.sound).toHaveBeenCalledWith(player, 0, 'items/flashlight_on.wav', 1, 3, 0);
    });

    it('toggles flashlight off when touched again', () => {
        player.flags = EntityFlags.Flashlight;
        player.renderfx = RenderFx.Flashlight;

        trigger.touch!(trigger, player, null, null);

        expect(player.flags & EntityFlags.Flashlight).toBeFalsy();
        expect(player.renderfx & RenderFx.Flashlight).toBeFalsy();
        expect(context.sound).toHaveBeenCalledWith(player, 0, 'items/flashlight_off.wav', 1, 3, 0);
    });

    it('forces on when style is 1', () => {
        trigger.style = 1;
        player.flags = 0;

        trigger.touch!(trigger, player, null, null);
        expect(player.flags & EntityFlags.Flashlight).toBeTruthy();

        // Touch again, should stay on
        trigger.touch!(trigger, player, null, null);
        expect(player.flags & EntityFlags.Flashlight).toBeTruthy();
    });

    it('forces off when style is 2', () => {
        trigger.style = 2;
        player.flags = EntityFlags.Flashlight;

        trigger.touch!(trigger, player, null, null);
        expect(player.flags & EntityFlags.Flashlight).toBeFalsy();
    });

    it('ignores non-clients', () => {
        const monster = context.spawn();
        monster.client = undefined;
        monster.flags = 0;

        trigger.touch!(trigger, monster, null, null);
        expect(monster.flags & EntityFlags.Flashlight).toBeFalsy();
    });
});
