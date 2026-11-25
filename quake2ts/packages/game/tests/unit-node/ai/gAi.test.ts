/**
 * The rerelease g_ai.cpp target finding and chasing, and g_monster.cpp's M_MoveFrame, run through
 * the real entity frame loop with a soldier on a flat floor.
 */
import { describe, expect, it } from 'vitest';
import { AIFlags } from '../../../src/ai/constants.js';
import { FindTarget, ai_checkattack, infront, range_to, visible } from '../../../src/ai/g_ai.js';
import { M_CheckBottom, M_walkmove } from '../../../src/ai/m_move.js';
import { floorWorld, FRAME } from './floorWorld.js';

const soldier = (x: number, angle = 0, extra = '') =>
  `{ "classname" "monster_soldier" "origin" "${x} 0 40" "angle" "${angle}" ${extra} }`;

describe('FindTarget', () => {
  it('a soldier notices a player in front of it, makes him its enemy and runs at him', () => {
    const { spawned, run, player } = floorWorld(soldier(0));
    const m = spawned[0];
    run(0.1);
    const p = player({ x: 300, y: 0, z: 0 });
    run(0.2);
    expect(m.enemy).toBe(p);
    expect(m.goalentity).toBe(p);
    // FoundTarget tells other monsters, through the player, who saw him and when.
    expect(p.client!.sight_entity).toBe(m);
    expect(p.show_hostile).toBeGreaterThan(0);
  });

  it('does not notice a player behind it at mid range', () => {
    const { spawned, run, player } = floorWorld(soldier(0, 180));
    const m = spawned[0];
    run(0.1);
    player({ x: 300, y: 0, z: 0 });
    run(0.5);
    expect(m.enemy).toBeNull();
  });

  it('does not notice a player behind a wall', () => {
    const { entities, spawned, run, player } = floorWorld(soldier(0), { walls: [150] });
    const m = spawned[0];
    run(0.1);
    const p = player({ x: 300, y: 0, z: 0 });
    expect(visible(m, p, entities)).toBe(false);
    run(0.5);
    expect(m.enemy).toBeNull();
  });

  it('hears a noise the player made this frame, even behind it, and goes to it', () => {
    const { entities, spawned, run, player } = floorWorld(soldier(0, 180));
    const m = spawned[0];
    run(0.1);
    const p = player({ x: 300, y: 0, z: 0 });
    const noise = entities.spawn();
    noise.classname = 'player_noise';
    noise.owner = p;
    noise.origin = { x: 300, y: 0, z: 24 };
    noise.mins = { x: -8, y: -8, z: -8 };
    noise.maxs = { x: 8, y: 8, z: 8 };
    entities.linkentity(noise);
    p.client!.sound_entity = noise;
    p.client!.sound_entity_time = entities.timeSeconds + FRAME;
    run(FRAME);
    expect(m.enemy).toBe(noise);
    expect(m.monsterinfo.aiflags & AIFlags.SoundTarget).toBeTruthy();
  });

  it('a monster another monster just got angry at a player wakes up when it sees that monster', () => {
    // The player is behind the second soldier, so it cannot see him itself, but it faces the
    // first soldier, who can.
    const { spawned, run, player } = floorWorld(soldier(0) + soldier(600, 180));
    const [first, second] = spawned;
    run(0.1);
    const p = player({ x: 900, y: 0, z: 0 });
    expect(infront(second, p)).toBe(false);
    run(0.1);
    expect(first.enemy).toBe(p);
    expect(second.enemy).toBe(p);
  });

  it('but not when it has its back to that monster', () => {
    const { spawned, run, player } = floorWorld(soldier(0) + soldier(600));
    const [first, second] = spawned;
    run(0.1);
    // The first soldier turns round and sees the player; the second has its back to both.
    player({ x: -800, y: 0, z: 0 });
    first.angles = { ...first.angles, y: 180 };
    run(0.1);
    expect(first.enemy).not.toBeNull();
    expect(second.enemy).toBeNull();
  });

  it('an ambush monster ignores a noise it cannot see', () => {
    const { entities, spawned, run, player } = floorWorld(soldier(0, 180, '"spawnflags" "1"'), { walls: [-150] });
    const m = spawned[0];
    run(0.1);
    const p = player({ x: -300, y: 0, z: 0 });
    p.client!.sound_entity = p;
    p.client!.sound_entity_time = entities.timeSeconds;
    expect(FindTarget(m, entities)).toBe(false);
  });
});

describe('perception', () => {
  it('range_to is the gap between the two boxes, infront is a wide cone', () => {
    const { spawned, run, player } = floorWorld(soldier(0));
    const m = spawned[0];
    run(0.1);
    const p = player({ x: 100, y: 0, z: 0 });
    expect(range_to(m, p)).toBeCloseTo(100 - 16 - 16, 3);
    expect(infront(m, p)).toBe(true);
    m.angles = { ...m.angles, y: 180 };
    expect(infront(m, p)).toBe(false);
  });
});

describe('ai_checkattack', () => {
  it('with no enemy and nothing to walk to, the monster stands and holds there', () => {
    const { entities, spawned, run } = floorWorld(soldier(0));
    const m = spawned[0];
    run(0.1);
    expect(ai_checkattack(m, 0, entities)).toBe(true);
    expect(m.monsterinfo.pausetime).toBeGreaterThan(1e9);
  });
});

describe('chasing', () => {
  it('a soldier that has seen the player closes on him', () => {
    const { spawned, run, player } = floorWorld(soldier(0));
    const m = spawned[0];
    run(0.1);
    const p = player({ x: 600, y: 0, z: 0 });
    run(0.2);
    expect(m.enemy).toBe(p);
    const start = range_to(m, p);
    // Make it never fire, so it only runs.
    m.monsterinfo.attack = undefined;
    run(2);
    expect(range_to(m, p)).toBeLessThan(start - 100);
    expect(m.origin.z).toBeCloseTo(-m.mins.z, 3);
  });

  it('a soldier whose enemy went behind a wall goes to where it last saw him', () => {
    const { spawned, run, player } = floorWorld(soldier(0));
    const m = spawned[0];
    run(0.1);
    const p = player({ x: 300, y: 0, z: 0 });
    run(0.2);
    expect(m.enemy).toBe(p);
    m.monsterinfo.attack = undefined;
    const seen = { ...m.monsterinfo.last_sighting };
    // The player steps out of sight, far away.
    p.origin = { x: 300, y: 5000, z: 24 };
    p.flags |= 1 << 24; // FL_NOVISIBLE
    run(0.5);
    expect(m.monsterinfo.aiflags & AIFlags.LostSight).toBeTruthy();
    expect(m.monsterinfo.last_sighting).toEqual(seen);
  });
});

describe('M_MoveFrame', () => {
  it('thinks every frame but steps animation frames at 10 Hz', () => {
    const { entities, spawned, run } = floorWorld(soldier(0));
    const m = spawned[0];
    run(0.1);
    const move = m.monsterinfo.current_move!;
    const frames = move.lastframe - move.firstframe + 1;
    expect(frames).toBeGreaterThan(2);
    const startFrame = m.frame;
    run(FRAME);
    expect(m.nextthink).toBeCloseTo(entities.timeSeconds + FRAME, 5);
    // Over half a second the frame moves on five times (wrapping round the move).
    const before = m.frame - move.firstframe;
    run(0.5);
    const after = m.frame - move.firstframe;
    expect((after - before + frames) % frames).toBe(5 % frames);
    expect(startFrame).toBeGreaterThanOrEqual(move.firstframe);
  });
});

describe('FindTarget, more', () => {
  it('a monster with AI_THIRD_EYE sees a visible player even behind it', () => {
    const { entities, spawned, run, player } = floorWorld(soldier(0, 180));
    const m = spawned[0];
    run(0.1);
    const p = player({ x: 300, y: 0, z: 0 });
    expect(FindTarget(m, entities)).toBe(false);
    m.monsterinfo.aiflags |= AIFlags.ThirdEye;
    expect(FindTarget(m, entities)).toBe(true);
    expect(m.enemy).toBe(p);
    // FoundTarget clears it once used.
    expect(m.monsterinfo.aiflags & AIFlags.ThirdEye).toBe(0);
  });

  it('a noise more than 1000 units away is not heard', () => {
    const { entities, spawned, run, player } = floorWorld(soldier(0, 180));
    const m = spawned[0];
    run(0.1);
    const p = player({ x: 1500, y: 0, z: 0 });
    p.client!.sound_entity = p;
    p.client!.sound_entity_time = entities.timeSeconds;
    expect(FindTarget(m, entities)).toBe(false);
    expect(m.enemy).toBeNull();
  });
});

describe('m_move', () => {
  it('M_walkmove steps along the floor, and not through a wall', () => {
    const { entities, spawned, run } = floorWorld(soldier(0), { walls: [40] });
    const m = spawned[0];
    run(0.1);
    expect(M_walkmove(m, 0, 8, entities)).toBe(true);
    expect(m.origin.x).toBeCloseTo(8, 3);
    // The wall face is at x = 40 and the soldier's box reaches 16 past its origin: a step
    // goes as far as it can, then the next one, straight into the wall, fails.
    expect(M_walkmove(m, 0, 30, entities)).toBe(true);
    expect(m.origin.x).toBeCloseTo(24, 3);
    expect(M_walkmove(m, 0, 8, entities)).toBe(false);
    expect(m.origin.x).toBeCloseTo(24, 3);
    // Sideways is fine.
    expect(M_walkmove(m, 90, 8, entities)).toBe(true);
    expect(m.origin.y).toBeCloseTo(8, 3);
  });

  it('M_walkmove refuses to walk off a ledge, and M_CheckBottom says why', () => {
    const { entities, spawned, run } = floorWorld(soldier(0), { ledge: 20 });
    const m = spawned[0];
    run(0.1);
    expect(M_CheckBottom(m, entities)).toBe(true);
    // The rerelease checks the middle of each quarter of the box, not its corners, so a monster
    // may hang a little over an edge...
    expect(M_walkmove(m, 0, 10, entities)).toBe(true);
    expect(m.origin.x).toBeCloseTo(10, 3);
    // ...but not so far that two quarters are over the drop.
    expect(M_walkmove(m, 0, 15, entities)).toBe(false);
    expect(m.origin.x).toBeCloseTo(10, 3);
    expect(M_walkmove(m, 180, 10, entities)).toBe(true);
  });

  it('a monster with no ground under it cannot walk', () => {
    const { entities, spawned, run } = floorWorld(soldier(0));
    const m = spawned[0];
    run(0.1);
    m.groundentity = null;
    expect(M_walkmove(m, 0, 8, entities)).toBe(false);
  });
});

describe('patrols', () => {
  it('a monster walks to its path_corner, then on to the next one it names', () => {
    const { spawned, run } = floorWorld(
      soldier(0, 0, '"target" "c1"') +
        '{ "classname" "path_corner" "targetname" "c1" "target" "c2" "origin" "100 0 32" }' +
        '{ "classname" "path_corner" "targetname" "c2" "target" "c1" "origin" "100 100 32" }',
    );
    const [m, c1, c2] = spawned;
    run(0.1);
    expect(m.movetarget).toBe(c1);
    run(6);
    expect(m.movetarget).toBe(c2);
    run(9);
    expect(m.movetarget).toBe(c1);
    expect(m.origin.y).toBeGreaterThan(50);
  });

  it('a path_corner with a wait stands the monster there for that long', () => {
    const { entities, spawned, run } = floorWorld(
      soldier(0, 0, '"target" "c1"') +
        '{ "classname" "path_corner" "targetname" "c1" "target" "c2" "wait" "3" "origin" "100 0 32" }' +
        '{ "classname" "path_corner" "targetname" "c2" "origin" "100 300 32" }',
    );
    const m = spawned[0];
    run(0.1);
    let arrived = 0;
    for (let i = 0; i < 200 && !arrived; i++) {
      run(FRAME);
      if (m.movetarget !== spawned[1]) arrived = entities.timeSeconds;
    }
    expect(arrived).toBeGreaterThan(0);
    expect(m.monsterinfo.pausetime).toBeCloseTo(arrived + 3, 1);
    const y = m.origin.y;
    run(2);
    expect(m.origin.y).toBeCloseTo(y, 0);
    run(2);
    expect(m.origin.y).toBeGreaterThan(y + 10);
  });
});
