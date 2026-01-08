
import { describe, it, expect } from 'vitest';
import { ServerCommand, ClientCommand } from '../../../src/protocol/ops.js';

describe('Protocol Ops', () => {
  it('should have correct ServerCommand values', () => {
    // Verify a few key values to ensure enum didn't shift
    expect(ServerCommand.bad).toBe(0);
    expect(ServerCommand.muzzleflash).toBe(1);
    expect(ServerCommand.frame).toBe(20);
    expect(ServerCommand.muzzleflash3).toBe(32);
    expect(ServerCommand.achievement).toBe(33);
  });

  it('should have correct ClientCommand values', () => {
      expect(ClientCommand.bad).toBe(0);
      expect(ClientCommand.move).toBe(2);
      expect(ClientCommand.stringcmd).toBe(4);
  });
});
