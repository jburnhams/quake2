import { describe, it, expect, vi } from 'vitest';
import { spawnGib, spawnHead, GIB_ORGANIC } from '../../src/entities/gibs';
import { createTestContext } from '@quake2ts/test-utils/game/helpers';
import { MulticastType } from '../../src/imports';
import { ServerCommand, TempEntity } from '@quake2ts/shared';

describe('Gib Effects', () => {
  it('should trigger TE_BLOOD shower for organic gibs', () => {
    const context = createTestContext();
    const { entities } = context;

    spawnGib(entities, { x: 0, y: 0, z: 0 }, 50, undefined, GIB_ORGANIC);

    // Verify multicast
    expect(entities.multicast).toHaveBeenCalledWith(
      expect.anything(),
      MulticastType.Pvs,
      ServerCommand.temp_entity,
      TempEntity.BLOOD,
      expect.any(Number), expect.any(Number), expect.any(Number),
      expect.any(Number), expect.any(Number), expect.any(Number)
    );
  });

  it('should trigger TE_BLOOD shower for head', () => {
    const context = createTestContext();
    const { entities } = context;

    spawnHead(entities, { x: 0, y: 0, z: 0 }, 50);

    // Verify multicast
    expect(entities.multicast).toHaveBeenCalledWith(
      expect.anything(),
      MulticastType.Pvs,
      ServerCommand.temp_entity,
      TempEntity.BLOOD,
      expect.any(Number), expect.any(Number), expect.any(Number),
      expect.any(Number), expect.any(Number), expect.any(Number)
    );
  });
});
