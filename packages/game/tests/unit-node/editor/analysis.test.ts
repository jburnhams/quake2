import { describe, it, expect, beforeEach } from 'vitest';
import { getActivationChain, getTriggerVolumes } from '../../../src/editor/analysis';
import { EntitySystem } from '../../../src/entities/system';
import { Solid } from '../../../src/entities/entity';

describe('Editor Analysis', () => {
  let sys: EntitySystem;

  beforeEach(() => {
    sys = new EntitySystem({} as any);
  });

  describe('getActivationChain', () => {
    it('should return single node for entity with no targets', () => {
      const ent = sys.spawn();
      ent.classname = 'start';

      const chains = getActivationChain(sys, ent.index);
      expect(chains).toHaveLength(1);
      expect(chains[0]).toEqual([ent.index]);
    });

    it('should trace simple target chain', () => {
      const e1 = sys.spawn();
      const e2 = sys.spawn();
      const e3 = sys.spawn();

      e1.target = 't1';
      e2.targetname = 't1';
      e2.target = 't2';
      e3.targetname = 't2';

      sys.finalizeSpawn(e1);
      sys.finalizeSpawn(e2);
      sys.finalizeSpawn(e3);

      const chains = getActivationChain(sys, e1.index);
      // e1 -> e2 -> e3
      expect(chains).toHaveLength(1);
      expect(chains[0]).toEqual([e1.index, e2.index, e3.index]);
    });

    it('should handle branching targets', () => {
      const e1 = sys.spawn();
      const e2a = sys.spawn();
      const e2b = sys.spawn();

      e1.target = 't1';
      e2a.targetname = 't1';
      e2b.targetname = 't1';

      sys.finalizeSpawn(e1);
      sys.finalizeSpawn(e2a);
      sys.finalizeSpawn(e2b);

      const chains = getActivationChain(sys, e1.index);
      expect(chains).toHaveLength(2);

      const expectedChainA = [e1.index, e2a.index];
      const expectedChainB = [e1.index, e2b.index];

      // We don't rely on allocation order for index sorting, just check set containment
      expect(chains).toEqual(expect.arrayContaining([expectedChainA, expectedChainB]));
    });

    it('should detect cycles and terminate', () => {
      const e1 = sys.spawn();
      const e2 = sys.spawn();

      e1.target = 't1';
      e2.targetname = 't1';
      e2.target = 't2';
      e1.targetname = 't2'; // Cycle back to e1

      sys.finalizeSpawn(e1);
      sys.finalizeSpawn(e2);

      const chains = getActivationChain(sys, e1.index);
      // e1 -> e2 -> e1
      expect(chains).toHaveLength(1);
      expect(chains[0]).toEqual([e1.index, e2.index, e1.index]);
    });
  });

  describe('getTriggerVolumes', () => {
    it('should identify trigger entities', () => {
      const t1 = sys.spawn();
      t1.classname = 'trigger_once';
      t1.solid = Solid.Trigger;

      const t2 = sys.spawn();
      t2.classname = 'trigger_multiple';
      t2.solid = Solid.Trigger;

      const notTrigger = sys.spawn();
      notTrigger.classname = 'info_player_start';
      notTrigger.solid = Solid.Not;

      const volumes = getTriggerVolumes(sys);
      expect(volumes).toHaveLength(2);
      expect(volumes.map(v => v.classname)).toContain('trigger_once');
      expect(volumes.map(v => v.classname)).toContain('trigger_multiple');
    });
  });
});
