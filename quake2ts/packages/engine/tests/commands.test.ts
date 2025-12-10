
import { describe, it, expect, vi } from 'vitest';
import { CommandRegistry, Command } from '../src/commands.js';

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

  it('should list commands', () => {
    const registry = new CommandRegistry();
    registry.register('cmd1', () => {});
    registry.register('cmd2', () => {});

    const commands = registry.list();
    expect(commands).toHaveLength(2);
    expect(commands.map(c => c.name)).toEqual(['cmd1', 'cmd2']);
  });

  it('should handle case insensitivity if needed (current implementation is sensitive)', () => {
    const registry = new CommandRegistry();
    const callback = vi.fn();
    registry.register('Test', callback);

    // Assuming implementation is case-sensitive for now based on code reading
    expect(registry.execute('test')).toBe(false);
    expect(registry.execute('Test')).toBe(true);
  });

  it('should handle quoted arguments', () => {
    const registry = new CommandRegistry();
    const callback = vi.fn();
    registry.register('echo', callback);

    registry.execute('echo "hello world" foo');
    expect(callback).toHaveBeenCalledWith(['hello world', 'foo']);
  });

  it('should emit onConsoleOutput for unknown commands', () => {
    const registry = new CommandRegistry();
    const outputSpy = vi.fn();
    registry.onConsoleOutput = outputSpy;

    registry.execute('unknown');
    expect(outputSpy).toHaveBeenCalledWith('Unknown command "unknown"');
  });

  it('should handle empty string gracefully', () => {
    const registry = new CommandRegistry();
    const outputSpy = vi.fn();
    registry.onConsoleOutput = outputSpy;

    const result = registry.execute('');
    expect(result).toBe(false);
    expect(outputSpy).not.toHaveBeenCalled();
  });

  it('should handle whitespace only string gracefully', () => {
    const registry = new CommandRegistry();
    const outputSpy = vi.fn();
    registry.onConsoleOutput = outputSpy;

    const result = registry.execute('   ');
    expect(result).toBe(false);
    expect(outputSpy).not.toHaveBeenCalled();
  });

  it('should support alias methods executeCommand and registerCommand', () => {
    const registry = new CommandRegistry();
    const callback = vi.fn();
    registry.registerCommand('test', callback);

    registry.executeCommand('test arg');

    expect(callback).toHaveBeenCalledWith(['arg']);
  });
});
