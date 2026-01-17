import { vi } from 'vitest';
import type { EngineHost, Cvar } from '@quake2ts/engine';

export function createMockEngineHost(overrides?: Partial<EngineHost>): EngineHost {
  const cvars = new Map<string, Cvar>();
  const commands = new Map<string, any>();

  return {
    cvars: {
      register: vi.fn((config) => {
        // Create a mock object that mimics Cvar structure but is mutable
        const cvar = {
          name: config.name,
          string: config.defaultValue || '',
          number: parseFloat(config.defaultValue || '0'),
          flags: config.flags || 0,
          modifiedCount: 0,
          description: config.description,
          onChange: config.onChange
        };
        cvars.set(config.name, cvar as unknown as Cvar);
        return cvar as unknown as Cvar;
      }),
      get: vi.fn((name) => cvars.get(name)),
      list: vi.fn(() => Array.from(cvars.values())),
      setValue: vi.fn((name, value, flags) => {
        const cvar = cvars.get(name) as any;
        if (cvar) {
          const previousValue = cvar.string;
          cvar.string = value;
          cvar.number = parseFloat(value);
          cvar.modifiedCount = (cvar.modifiedCount || 0) + 1;
          if (cvar.onChange) {
            cvar.onChange(cvar, previousValue);
          }
        }
      }),
    },
    commands: {
      register: vi.fn((name, callback) => {
        commands.set(name, callback);
      }),
      execute: vi.fn(),
    },
    ...overrides
  } as unknown as EngineHost;
}
