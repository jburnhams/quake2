import { describe, expect, it } from 'vitest';
import {
  CollisionEntityIndex,
  type CollisionEntityLink,
  type CollisionModel,
} from '../../../src/bsp/collision.js';
import { CONTENTS_SOLID, CONTENTS_TRIGGER } from '../../../src/bsp/contents.js';
import type { Vec3 } from '../../../src/math/vec3.js';

describe('CollisionEntityIndex', () => {
  it('should ignore entity specified by passId during trace', () => {
    const index = new CollisionEntityIndex();
    const entity: CollisionEntityLink = {
      id: 1,
      origin: { x: 100, y: 0, z: 0 },
      mins: { x: -16, y: -16, z: -16 },
      maxs: { x: 16, y: 16, z: 16 },
      contents: CONTENTS_SOLID,
    };
    index.link(entity);

    const start = { x: 0, y: 0, z: 0 } satisfies Vec3;
    const end = { x: 200, y: 0, z: 0 } satisfies Vec3;

    // Normal trace should hit it
    const traceHit = index.trace({
      model: undefined as unknown as CollisionModel, // No world model for this test
      start,
      end,
      mins: { x: -16, y: -16, z: -16 },
      maxs: { x: 16, y: 16, z: 16 },
    });
    expect(traceHit.entityId).toBe(1);
    expect(traceHit.fraction).toBeLessThan(1);

    // Trace with passId should ignore it
    const tracePass = index.trace({
      model: undefined as unknown as CollisionModel,
      start,
      end,
      mins: { x: -16, y: -16, z: -16 },
      maxs: { x: 16, y: 16, z: 16 },
      passId: 1,
    });
    expect(tracePass.entityId).toBeNull();
    expect(tracePass.fraction).toBe(1);
  });

  it('should correctly filter entities based on contentMask', () => {
     const index = new CollisionEntityIndex();
     const solidEntity: CollisionEntityLink = {
       id: 1,
       origin: { x: 100, y: 0, z: 0 },
       mins: { x: -16, y: -16, z: -16 },
       maxs: { x: 16, y: 16, z: 16 },
       contents: CONTENTS_SOLID,
     };
     const triggerEntity: CollisionEntityLink = {
        id: 2,
        origin: { x: 200, y: 0, z: 0 },
        mins: { x: -16, y: -16, z: -16 },
        maxs: { x: 16, y: 16, z: 16 },
        contents: CONTENTS_TRIGGER,
      };

      index.link(solidEntity);
      index.link(triggerEntity);

      const start = { x: 0, y: 0, z: 0 } satisfies Vec3;
      const end = { x: 300, y: 0, z: 0 } satisfies Vec3;

      // Trace with only SOLID mask
      const traceSolid = index.trace({
        model: undefined as unknown as CollisionModel,
        start,
        end,
        mins: { x: -16, y: -16, z: -16 },
        maxs: { x: 16, y: 16, z: 16 },
        contentMask: CONTENTS_SOLID,
      });
      expect(traceSolid.entityId).toBe(1);

      // Trace with TRIGGER mask
      const traceTrigger = index.trace({
          model: undefined as unknown as CollisionModel,
          start,
          end,
          mins: { x: -16, y: -16, z: -16 },
          maxs: { x: 16, y: 16, z: 16 },
          contentMask: CONTENTS_TRIGGER,
        });
        // Should hit solid first? No, we masked for trigger. But wait, CONTENTS_SOLID is not in mask?
        // If contentMask is CONTENTS_TRIGGER, and entity 1 is CONTENTS_SOLID.
        // 1 & 2 = 0. So it skips entity 1.
        // It should hit entity 2.
        expect(traceTrigger.entityId).toBe(2);
  });

   it('should pick the closest entity when multiple are hit', () => {
       const index = new CollisionEntityIndex();
       const ent1: CollisionEntityLink = {
         id: 1,
         origin: { x: 100, y: 0, z: 0 },
         mins: { x: -16, y: -16, z: -16 },
         maxs: { x: 16, y: 16, z: 16 },
         contents: CONTENTS_SOLID,
       };
       const ent2: CollisionEntityLink = {
          id: 2,
          origin: { x: 200, y: 0, z: 0 },
          mins: { x: -16, y: -16, z: -16 },
          maxs: { x: 16, y: 16, z: 16 },
          contents: CONTENTS_SOLID,
        };

        index.link(ent1);
        index.link(ent2);

        const start = { x: 0, y: 0, z: 0 } satisfies Vec3;
        const end = { x: 300, y: 0, z: 0 } satisfies Vec3;

        const trace = index.trace({
          model: undefined as unknown as CollisionModel,
          start,
          end,
          mins: { x: -16, y: -16, z: -16 },
          maxs: { x: 16, y: 16, z: 16 },
        });

        expect(trace.entityId).toBe(1);
   });
});
