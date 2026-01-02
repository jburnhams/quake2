import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CommandRegistry } from '../../src/commands';

describe('CommandRegistry', () => {
  let registry: CommandRegistry;

  beforeEach(() => {
    registry = new CommandRegistry();
  });

  describe('registration and execution', () => {
    it('registers and executes commands', () => {
      const callback = vi.fn();
      registry.register('test', callback);

      const success = registry.execute('test arg1 arg2');

      expect(success).toBe(true);
      expect(callback).toHaveBeenCalledWith(['arg1', 'arg2']);
    });

    it('supports registerCommand alias', () => {
      const callback = vi.fn();
      registry.registerCommand('test', callback);

      registry.execute('test');
      expect(callback).toHaveBeenCalled();
    });

    it('supports executeCommand alias', () => {
        const callback = vi.fn();
        registry.register('test', callback);

        registry.executeCommand('test arg');
        expect(callback).toHaveBeenCalledWith(['arg']);
    });

    it('handles quoted arguments', () => {
      const callback = vi.fn();
      registry.register('test', callback);

      registry.execute('test "arg 1" arg2');

      expect(callback).toHaveBeenCalledWith(['arg 1', 'arg2']);
    });

    it('returns false for unknown commands', () => {
      const success = registry.execute('unknown');
      expect(success).toBe(false);
    });

    it('triggers onConsoleOutput for unknown commands', () => {
        const outputSpy = vi.fn();
        registry.onConsoleOutput = outputSpy;

        registry.execute('unknown_cmd');

        expect(outputSpy).toHaveBeenCalledWith('Unknown command "unknown_cmd"');
    });

    it('lists registered commands sorted by name', () => {
        registry.register('beta', () => {});
        registry.register('alpha', () => {});

        const list = registry.list();

        expect(list).toHaveLength(2);
        expect(list[0].name).toBe('alpha');
        expect(list[1].name).toBe('beta');
    });
  });

  describe('history', () => {
    it('stores executed commands in history', () => {
      registry.register('cmd1', () => {});
      registry.register('cmd2', () => {});

      registry.execute('cmd1');
      registry.execute('cmd2 arg');
      registry.execute('unknown'); // Should also be in history typically

      const history = registry.getHistory();
      expect(history).toContain('cmd1');
      expect(history).toContain('cmd2 arg');
      expect(history).toContain('unknown');
    });

    it('limits history size', () => {
        for (let i = 0; i < 70; i++) {
            registry.execute(`cmd${i}`);
        }
        expect(registry.getHistory().length).toBeLessThanOrEqual(64);
        expect(registry.getHistory().at(-1)).toBe('cmd69');
    });

    it('does not add empty commands to history', () => {
        registry.execute('');
        expect(registry.getHistory()).toHaveLength(0);
    });

    it('does not add duplicate consecutive commands to history', () => {
        registry.execute('cmd1');
        registry.execute('cmd1');
        expect(registry.getHistory()).toHaveLength(1);
    });
  });

  describe('autocomplete', () => {
    it('suggests registered commands', () => {
      registry.register('alpha', () => {});
      registry.register('alberto', () => {});
      registry.register('beta', () => {});

      const suggestions = registry.getSuggestions('al');
      expect(suggestions).toContain('alpha');
      expect(suggestions).toContain('alberto');
      expect(suggestions).not.toContain('beta');
    });

    it('supports external providers', () => {
      registry.registerAutocompleteProvider(() => ['cvar_alpha', 'cvar_beta']);

      const suggestions = registry.getSuggestions('cvar_');
      expect(suggestions).toContain('cvar_alpha');
      expect(suggestions).toContain('cvar_beta');
    });

    it('sorts suggestions', () => {
        registry.register('b', () => {});
        registry.register('a', () => {});
        const suggestions = registry.getSuggestions('');
        expect(suggestions).toEqual(['a', 'b']);
    });
  });
});
