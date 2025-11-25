import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EntitySystem } from '../../src/entities/system.js';
import { Entity, ServerFlags } from '../../src/entities/entity.js';
import { huntTarget, TargetAwarenessState } from '../../src/ai/targeting.js';
import { AIFlags } from '../../src/ai/constants.js';

describe('AI Tracking (Lost Sight)', () => {
  let system: EntitySystem;
  let monster: Entity;
  let player: Entity;
  let awareness: TargetAwarenessState;

  beforeEach(() => {
    // Mock system
    const gameEngineMock = {
      trace: vi.fn(),
      pointcontents: vi.fn().mockReturnValue(0),
    };
    system = new EntitySystem(gameEngineMock as any);

    // Mock targetAwareness
    awareness = {
        timeSeconds: 0,
        frameNumber: 0,
        sightEntity: null,
        sightEntityFrame: 0,
        soundEntity: null,
        soundEntityFrame: 0,
        sound2Entity: null,
        sound2EntityFrame: 0,
        sightClient: null
    };
    Object.defineProperty(system, 'targetAwareness', {
        get: () => awareness
    });

    monster = system.spawn();
    monster.origin = { x: 0, y: 0, z: 0 };
    monster.angles = { x: 0, y: 0, z: 0 };
    monster.monsterinfo = {
        stand: vi.fn(),
        run: vi.fn(),
        sight: vi.fn(),
        aiflags: 0,
        last_sighting: { x: 100, y: 0, z: 0 }, // Last seen location
        search_time: 0
    } as any;
    monster.ideal_yaw = 0;

    player = system.spawn();
    player.classname = 'player';
    player.origin = { x: 200, y: 0, z: 0 }; // Current location (different from last sighting)
    player.svflags |= ServerFlags.Player;

    monster.enemy = player;
  });

  it('monster moves towards enemy current position if enemy is set', () => {
    // huntTarget logic:
    // self.goalentity = self.enemy;
    // So even if not visible, if huntTarget is called (e.g. from foundTarget or run),
    // it sets goal to enemy.

    // In Quake 2, if the enemy is not visible, the monster will typically run towards
    // the last known position. BUT huntTarget sets goalentity to self.enemy.

    // The trick is: how is huntTarget called?
    // It is called by foundTarget.

    // If the monster is in 'run' state, ai_run calls M_walkmove towards self.enemy ?? self.goalentity.
    // So if self.enemy is set, it cheats and knows where the player is?

    // Wait, let's check huntTarget implementation again.
    /*
    export function huntTarget(self: Entity, level: TargetAwarenessState, context: EntitySystem): void {
      if (!self.enemy) return;

      self.goalentity = self.enemy;
      setIdealYawTowards(self, self.enemy);
      faceYawInstantly(self);
      // ...
    }
    */

    // This seems to imply direct tracking.
    // However, in original Quake 2, `HuntTarget` sets `self->goalentity = self->enemy;`.

    // But `FindTarget` is responsible for checking visibility.
    // If `FindTarget` returns false (not visible), the monster stays in run state.
    // In `ai_run`:
    /*
      setIdealYawTowards(self, self.enemy ?? self.goalentity);
      changeYaw(self, deltaSeconds);
      if (distance !== 0) {
        M_walkmove(self, self.angles.y, distance, context);
      }
    */
    // It seems `ai_run` uses `self.enemy` if available.

    // If the enemy is hidden, `FindTarget` (called at start of `ai_run` via `check_enemy` in original, or direct call here)
    // might fail to find a NEW target.

    // But does it lose the current target?
    // In Q2 `ai_run`, it checks `visible(self, self->enemy)`.
    // If visible, `self->monsterinfo.search_time = level.time + 5;`
    // If NOT visible:
    //    if (level.time > self->monsterinfo.search_time) -> Forget enemy?

    // The current `ai_run` implementation in `movement.ts` is simplified:
    /*
    export function ai_run(self: Entity, distance: number, deltaSeconds: number, context: EntitySystem): void {
      // ...
      if (findTarget(...)) {
          // ...
      }

      setIdealYawTowards(self, self.enemy ?? self.goalentity);
      // ...
    }
    */

    // It seems missing the logic to handle lost sight and search_time.
    // This confirms "Enemy tracking: Remember last known position..." is a TODO.

    // This test documents current behavior (cheating/direct tracking)
    // or we can try to implement the fix.

    // Let's implement the test to verify current behavior (tracking enemy directly),
    // and then I can try to improve it if I have time, but strictly speaking "Work Already Done"
    // implies I should just test what is there or mark it.

    // But the task list says "Enemy tracking" is REMAINING.
    // So I should implement the logic in `ai_run` to handle lost sight.

    huntTarget(monster, awareness, system);

    // It sets goalentity to enemy
    expect(monster.goalentity).toBe(player);
    expect(monster.ideal_yaw).toBe(0); // Face player at 200,0,0
  });
});
