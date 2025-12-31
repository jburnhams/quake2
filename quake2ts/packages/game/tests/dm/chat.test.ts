import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EntitySystem } from '../../src/entities/system.js';
import { Entity } from '../../src/entities/entity.js';
import { cmd_say } from '../../src/dm/chat.js';
import { createTestContext } from '@quake2ts/test-utils/game/helpers';
import { createPlayerInventory } from '../../src/inventory/playerInventory.js';

describe('Chat System', () => {
    let sys: EntitySystem;
    let player: Entity;

    beforeEach(() => {
        const ctx = createTestContext();
        sys = ctx.entities;

        // Mock serverCommand
        sys.imports.serverCommand = vi.fn();

        // Create player
        player = new Entity(1);
        player.classname = 'player';
        player.client = {
            // index removed
            pers: {
                netname: 'TestPlayer',
            },
            inventory: createPlayerInventory()
        } as any;
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('cmd_say should broadcast message from player', () => {
        cmd_say(sys, player, 'Hello World', false);

        expect(sys.imports.serverCommand).toHaveBeenCalledWith('print 2 "TestPlayer: Hello World\n"');
    });

    it('cmd_say should broadcast message from Console', () => {
        cmd_say(sys, null, 'Server Message', false);

        expect(sys.imports.serverCommand).toHaveBeenCalledWith('print 2 "Console: Server Message\n"');
    });

    it('cmd_say should ignore empty messages', () => {
        cmd_say(sys, player, '', false);
        cmd_say(sys, player, '   ', false);

        expect(sys.imports.serverCommand).not.toHaveBeenCalled();
    });

    it('cmd_say should handle team chat', () => {
        cmd_say(sys, player, 'Team Plan', true);

        // Currently implemented as [TEAM] prefix to all
        expect(sys.imports.serverCommand).toHaveBeenCalledWith('print 2 "[TEAM] TestPlayer: Team Plan\n"');
    });
});
