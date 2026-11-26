import { describe, expect, it } from 'vitest';
import { createEntityFactory } from '@quake2ts/test-utils';
import { ENTITY_FIELD_METADATA } from '../../../src/index.js';

describe('AI entity fields', () => {
  it('initializes and resets timing/yaw search fields to zero', () => {
    const entity = createEntityFactory({ number: 0 });

    expect(entity.search_time).toBe(0);
    expect(entity.attack_finished_time).toBe(0);
    expect(entity.pain_finished_time).toBe(0);

    entity.search_time = 2.5;
    entity.attack_finished_time = 1.25;
    entity.pain_finished_time = 3.75;

    entity.reset();

    expect(entity.search_time).toBe(0);
    expect(entity.attack_finished_time).toBe(0);
    expect(entity.pain_finished_time).toBe(0);
  });

  it('exposes timing fields to the save metadata', () => {
    const names = ENTITY_FIELD_METADATA.map((descriptor) => descriptor.name);

    expect(names).toContain('search_time');
    expect(names).toContain('attack_finished_time');
    expect(names).toContain('pain_finished_time');
  });
});

