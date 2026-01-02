
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ClientNetworkHandler } from '@quake2ts/client/demo/handler.js';
import { ViewEffects } from '@quake2ts/cgame';
import { DamageIndicator, FogData, FrameData } from '@quake2ts/engine';
import { Vec3, ZERO_VEC3 } from '@quake2ts/shared';

describe('ClientNetworkHandler Damage Kick', () => {
    let handler: ClientNetworkHandler;
    let view: ViewEffects;

    beforeEach(() => {
        handler = new ClientNetworkHandler();
        view = new ViewEffects();
        // Mock view.addKick
        vi.spyOn(view, 'addKick');
        handler.setView(view);
    });

    it('should add kick on damage', () => {
        const indicators: DamageIndicator[] = [{
            dir: { x: 1, y: 0, z: 0 },
            damage: 10,
            health: true,
            armor: false,
            power: false
        }];

        handler.onDamage(indicators);

        // Expect view.addKick to be called
        expect(view.addKick).toHaveBeenCalled();

        const kickArgs = vi.mocked(view.addKick).mock.calls[0][0];
        expect(kickArgs).toBeDefined();

        // We expect some kick parameters
        expect(kickArgs.durationMs).toBeGreaterThan(0);
        // We expect pitch or roll to be set based on direction
        // Pitch should be kicked
        expect(kickArgs.pitch).not.toBe(0);
    });
});
