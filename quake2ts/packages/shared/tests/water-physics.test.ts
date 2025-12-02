import { describe, expect, it } from 'vitest';
import { applyPmove } from '../src/pmove/apply.js';
import type { PlayerState } from '../src/protocol/player-state.js';
import type { PmoveCmd, PmoveTraceResult } from '../src/pmove/types.js';
import type { Vec3 } from '../src/math/vec3.js';
import { lengthVec3, normalizeVec3 } from '../src/math/vec3.js';

describe('Water Physics', () => {
    // Helper to create a basic player state for water tests
    const createWaterPlayerState = (overrides: Partial<PlayerState> = {}): PlayerState => ({
        origin: { x: 0, y: 0, z: 0 },
        velocity: { x: 0, y: 0, z: 0 },
        viewAngles: { x: 0, y: 0, z: 0 },
        onGround: false, // In water, usually not on ground
        waterLevel: 2,   // Valid water level for swimming (Waist or deeper)
        mins: { x: -16, y: -16, z: -24 },
        maxs: { x: 16, y: 16, z: 32 },
        damageAlpha: 0,
        damageIndicators: [],
        blend: [0, 0, 0, 0],
        stats: [],
        kick_angles: { x: 0, y: 0, z: 0 },
        kick_origin: { x: 0, y: 0, z: 0 },
        gunoffset: { x: 0, y: 0, z: 0 },
        gunangles: { x: 0, y: 0, z: 0 },
        gunindex: 0,
        pm_type: 0,
        pm_time: 0,
        pm_flags: 0,
        gun_frame: 0,
        rdflags: 0,
        fov: 90,
        ...overrides,
    });

    const freeMovementTrace = (start: Vec3, end: Vec3): PmoveTraceResult => ({
        fraction: 1.0,
        endpos: end,
        allsolid: false,
        startsolid: false,
    });

    // Mock point contents to simulate water environment everywhere
    const waterPointContents = (_point: Vec3): number => 0x2000000; // MASK_WATER
    const airPointContents = (_point: Vec3): number => 0;

    describe('Vertical Upmove', () => {
        it('swims up with upmove=127', () => {
            let state = createWaterPlayerState();
            const cmd: PmoveCmd = { forwardmove: 0, sidemove: 0, upmove: 127 };

            for (let i = 0; i < 10; i++) {
                state = applyPmove(state, cmd, freeMovementTrace, waterPointContents);
            }

            expect(state.velocity.z).toBeGreaterThan(10);
        });

        it('swims down with upmove=-127', () => {
            let state = createWaterPlayerState();
            const cmd: PmoveCmd = { forwardmove: 0, sidemove: 0, upmove: -127 };

            for (let i = 0; i < 10; i++) {
                state = applyPmove(state, cmd, freeMovementTrace, waterPointContents);
            }

            expect(state.velocity.z).toBeLessThan(-10);
        });

        it('sinks slowly when no input is given (water drift)', () => {
             let state = createWaterPlayerState();
             const cmd: PmoveCmd = { forwardmove: 0, sidemove: 0, upmove: 0 };

             for (let i = 0; i < 10; i++) {
                state = applyPmove(state, cmd, freeMovementTrace, waterPointContents);
            }

            // Should drift downwards
            expect(state.velocity.z).toBeLessThan(0);
        });
    });

    describe('Forward Movement with Pitch', () => {
         it('swims horizontally with pitch=0', () => {
            let state = createWaterPlayerState({ viewAngles: { x: 0, y: 0, z: 0 } });
            const cmd: PmoveCmd = { forwardmove: 127, sidemove: 0, upmove: 0 };

            for (let i = 0; i < 10; i++) {
                state = applyPmove(state, cmd, freeMovementTrace, waterPointContents);
            }

            expect(state.velocity.x).toBeGreaterThan(10);
            // Z should have a slight upward bias (drift) when moving horizontally, matching Quake 2 behavior
            // It applies +10 to wishvel.z
            expect(state.velocity.z).toBeGreaterThan(0);
            expect(state.velocity.z).toBeLessThan(20); // Should be small, not full speed
         });

         it('swims diagonally up with pitch=-45 (looking up)', () => {
            let state = createWaterPlayerState({ viewAngles: { x: -45, y: 0, z: 0 } });
            const cmd: PmoveCmd = { forwardmove: 127, sidemove: 0, upmove: 0 };

            for (let i = 0; i < 10; i++) {
                state = applyPmove(state, cmd, freeMovementTrace, waterPointContents);
            }

            expect(state.velocity.x).toBeGreaterThan(10);
            expect(state.velocity.z).toBeGreaterThan(10);
         });

         it('swims diagonally down with pitch=45 (looking down)', () => {
            let state = createWaterPlayerState({ viewAngles: { x: 45, y: 0, z: 0 } });
            const cmd: PmoveCmd = { forwardmove: 127, sidemove: 0, upmove: 0 };

            for (let i = 0; i < 10; i++) {
                state = applyPmove(state, cmd, freeMovementTrace, waterPointContents);
            }

            expect(state.velocity.x).toBeGreaterThan(10);
            expect(state.velocity.z).toBeLessThan(-10);
         });
    });

    describe('Combined Movement', () => {
        it('combines forward and upmove', () => {
            let state = createWaterPlayerState({ viewAngles: { x: 0, y: 0, z: 0 } });
            const cmd: PmoveCmd = { forwardmove: 127, sidemove: 0, upmove: 127 };

            for (let i = 0; i < 10; i++) {
                state = applyPmove(state, cmd, freeMovementTrace, waterPointContents);
            }

            expect(state.velocity.x).toBeGreaterThan(10);
            expect(state.velocity.z).toBeGreaterThan(10);
        });

        it('combines strafe and upmove', () => {
            let state = createWaterPlayerState({ viewAngles: { x: 0, y: 0, z: 0 } });
            const cmd: PmoveCmd = { forwardmove: 0, sidemove: 127, upmove: 127 };

            for (let i = 0; i < 10; i++) {
                state = applyPmove(state, cmd, freeMovementTrace, waterPointContents);
            }

            // Strafe right (assuming y axis is right)
            expect(Math.abs(state.velocity.y)).toBeGreaterThan(10);
            expect(state.velocity.z).toBeGreaterThan(10);
        });
    });

    describe('Water Friction and Levels', () => {
        it('applies friction (velocity decays)', () => {
            let state = createWaterPlayerState({
                velocity: { x: 200, y: 0, z: 0 }
            });
            const cmd: PmoveCmd = { forwardmove: 0, sidemove: 0, upmove: 0 };

            // We expect some sink/drift, but horizontal velocity X should decay.
            for (let i = 0; i < 10; i++) {
                state = applyPmove(state, cmd, freeMovementTrace, waterPointContents);
            }

            expect(state.velocity.x).toBeLessThan(200);
            expect(state.velocity.x).toBeGreaterThan(0);
        });

        it('does not apply water friction if not in water', () => {
             // Mock air
             let state = createWaterPlayerState({
                 velocity: { x: 200, y: 0, z: 0 },
                 waterLevel: 0,
                 onGround: false // Air
             });
             const cmd: PmoveCmd = { forwardmove: 0, sidemove: 0, upmove: 0 };

             // Air resistance is negligible or different? Standard Q2 air has no friction usually?
             // Actually applyPmoveFriction handles ground/ladder/water.
             // If air, no friction function is called for air?
             // Let's check applyPmove logic. It calls applyPmoveFriction.
             // friction function checks:
             // if ((onGround ...) || onLadder) ...
             // if (waterlevel > 0 ...) ...
             // So in AIR (waterlevel 0, onGround false), NO friction is applied in that function.

             for (let i = 0; i < 10; i++) {
                state = applyPmove(state, cmd, freeMovementTrace, airPointContents);
            }

            // Should remain 200 (or close, gravity might affect z, but x should be preserved)
            expect(state.velocity.x).toBeCloseTo(200, 1);
        });
    });

    describe('Water Transitions', () => {
        it('transitions from water to air (surface)', () => {
            // Start deep, move up to surface
            // We'll simulate this by changing the pointContents mock response based on Z check?
            // Or just manually change state between calls? applyPmove is pure functional.
            // We can just call it once with water, then with air.

            let state = createWaterPlayerState({
                 velocity: { x: 0, y: 0, z: 200 }, // Moving up fast
                 waterLevel: 2
            });
            const cmd: PmoveCmd = { forwardmove: 0, sidemove: 0, upmove: 0 };

            // 1. In water
            state = applyPmove(state, cmd, freeMovementTrace, waterPointContents);
            // Velocity should decay due to water friction
            const waterVel = state.velocity.z;
            expect(waterVel).toBeLessThan(200);

            // 2. Exit water (Air)
            // Manually set pointContents to air for next step
            // And ensure checkWater detects it
            state = applyPmove(state, cmd, freeMovementTrace, airPointContents);

            // In air, gravity should apply (if gravity logic is in applyPmove? No, applyPmove usually handles velocity/position.
            // Wait, applyPmove logic:
            // It calls applyPmoveAccelerate. Gravity is usually applied OUTSIDE pmove in SV_Physics_Toss or similar,
            // OR inside PM_AirMove?
            // PM_AirMove usually doesn't apply gravity. PM_CheckWaterJump etc.
            // However, applyPmove integration test doesn't seem to account for gravity explicitly?
            // Checking apply.ts:
            // It does NOT seem to apply gravity. Gravity is usually a separate step `SV_AddGravity` or `PM_AddGravity`.
            // So in air, velocity Z should remain constant (no friction, no gravity).

            expect(state.velocity.z).toBeCloseTo(waterVel, 1); // Should not lose more speed to friction
            expect(state.waterLevel).toBe(0);
        });
    });
});
