import { describe, it, expect, vi } from 'vitest';
import { CommandRegistry } from '../src/commands.js';

describe('CommandRegistry', () => {
  it('should register and execute a command', () => {
    const registry = new CommandRegistry();
    const callback = vi.fn();

    registry.register('test', callback);
    const result = registry.execute('test arg1 arg2');

    expect(result).toBe(true);
    expect(callback).toHaveBeenCalledWith(['arg1', 'arg2']);
  });

  it('should return false for unknown command', () => {
    const registry = new CommandRegistry();
    const result = registry.execute('unknown');
    expect(result).toBe(false);
  });

  it('should be case sensitive (usually)', () => {
    // Q2 commands are often case-insensitive but strict implementation for now is fine
    const registry = new CommandRegistry();
    const callback = vi.fn();
    registry.register('Test', callback);

    expect(registry.execute('test')).toBe(false);
    expect(registry.execute('Test')).toBe(true);
  });

  it('should handle empty string', () => {
    const registry = new CommandRegistry();
    expect(registry.execute('')).toBe(false);
    expect(registry.execute('   ')).toBe(false);
  });
});
