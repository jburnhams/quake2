import { describe, it, expect, vi, beforeEach } from 'vitest';
import { func_door_rotating } from '../../src/entities/funcs.js';
import { createTestContext } from '../test-helpers.js';
import { Entity, MoveType, Solid } from '../../src/entities/entity.js';
import { lengthVec3 } from '@quake2ts/shared';

describe('func_door_rotating acceleration', () => {
    let context;
    let entity;

    beforeEach(() => {
        context = createTestContext();
        entity = new Entity(1);
        // Setup minimal entity properties for func_door_rotating
        entity.classname = 'func_door_rotating';
        entity.speed = 100;
        entity.wait = 3;
        entity.accel = 100; // Use accel
        entity.decel = 100; // Use decel
        entity.spawnflags = 0; // Z-axis default (Yaw)

        // Mock EntitySystem properties needed for move_calc/angle_move_calc
        // We need to capture the think callback to simulate frames
        context.entities.scheduleThink = vi.fn((ent, time) => {
            ent.nextthink = time;
        });

        context.entities.linkentity = vi.fn();
    });

    it('should accelerate angular velocity when opening', () => {
        func_door_rotating(entity, context);

        // Trigger the door to open
        entity.use(entity, null, null);

        // Should be in Opening state
        expect(entity.state).toBe(1); // DoorState.Opening

        // Check initial think setup
        expect(context.entities.scheduleThink).toHaveBeenCalled();
        const thinkFn = entity.think;
        expect(thinkFn).toBeDefined();

        // Initial angular velocity should be low if accelerating?
        // angle_move_calc sets:
        // let currentSpeed = speed;
        // if (ent.accel) currentSpeed = lengthVec3(ent.avelocity) + ent.accel * dt;

        // Initial avelocity is 0,0,0
        // dt is 0.1
        // accel is 100
        // currentSpeed = 0 + 100 * 0.1 = 10.
        // speed is 100.

        // So after use(), entity.avelocity should be set based on initial acceleration step.
        const initialSpeed = lengthVec3(entity.avelocity);

        // Expected: 0 + 100 * 0.1 = 10
        expect(initialSpeed).toBeCloseTo(10);

        // Simulate next frame
        // Advance time and call think
        context.entities.timeSeconds += 0.1;
        if (thinkFn) thinkFn(entity);

        // New speed should be previous speed + accel * dt
        // 10 + 100 * 0.1 = 20
        const secondFrameSpeed = lengthVec3(entity.avelocity);
        expect(secondFrameSpeed).toBeCloseTo(20);
    });

    it('should decelerate when approaching target', () => {
         func_door_rotating(entity, context);

         // Trigger open
         entity.use(entity, null, null);

         // Verify we started
         expect(entity.think).toBeDefined();

         // Overwrite state for test to simulate approaching target
         // Default func_door_rotating (Z-axis) rotates around Z, modifying Yaw (Y-component).
         // Target pos2 is at 90 degrees Yaw (by default dist=90) -> {0, 90, 0}

         entity.angles = { x: 0, y: 80, z: 0 }; // 10 units away on Y axis
         entity.avelocity = { x: 0, y: 50, z: 0 }; // Speed 50 along Y axis

         // currentSpeed = 50.
         // dist = 10.
         // decel = 100.
         // distToStop = (50*50) / (2*100) = 2500 / 200 = 12.5.

         // dist (10) <= distToStop (12.5). Should decelerate.
         // However, move_calc (and thus angle_move_calc) applies acceleration first!
         // 1. Current Speed: 50
         // 2. Accel: 50 + 10 = 60
         // 3. Decel check: dist (10) <= distToStop(60^2/200 = 18). True.
         // 4. Decel: 60 - 10 = 50

         const thinkFn = entity.think;
         if (!thinkFn) {
             throw new Error("thinkFn lost after use()");
         }

         // Run one frame
         thinkFn(entity);

         const newSpeed = lengthVec3(entity.avelocity);
         expect(newSpeed).toBeCloseTo(50);
    });
});
