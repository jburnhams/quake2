import { vi } from 'vitest';

export interface MockConsole {
  // Add Console interface methods here as needed, based on usage in engine/client
  // Currently the Console interface is not strictly defined in shared types for test-utils
  // but we mimic what is commonly used.
  print: (text: string) => void;
  error: (text: string) => void;
  execute: (text: string) => void;
  addCommand: (name: string, handler: (args: string[]) => void) => void;
  getCvar: (name: string) => string | undefined;
  setCvar: (name: string, value: string) => void;

  // Test helpers
  getHistory: () => string[];
  clearHistory: () => void;
  getErrors: () => string[];
}

export interface MockCommand {
  name: string;
  handler: (args: string[]) => void;
}

export interface CvarRegistry {
  [key: string]: string;
}

export function createMockConsole(overrides?: Partial<MockConsole>): MockConsole {
  const history: string[] = [];
  const errors: string[] = [];
  const commands: Record<string, (args: string[]) => void> = {};
  const cvars: Record<string, string> = {};

  return {
    print: vi.fn((text: string) => {
      history.push(text);
    }),
    error: vi.fn((text: string) => {
      errors.push(text);
    }),
    execute: vi.fn((text: string) => {
      const parts = text.trim().split(/\s+/);
      const cmd = parts[0];
      const args = parts.slice(1);
      if (commands[cmd]) {
        commands[cmd](args);
      } else {
        history.push(`Unknown command "${cmd}"`);
      }
    }),
    addCommand: vi.fn((name: string, handler: (args: string[]) => void) => {
      commands[name] = handler;
    }),
    getCvar: vi.fn((name: string) => cvars[name]),
    setCvar: vi.fn((name: string, value: string) => {
      cvars[name] = value;
    }),
    getHistory: () => history,
    clearHistory: () => {
      history.length = 0;
      errors.length = 0;
    },
    getErrors: () => errors,
    ...overrides
  };
}

export function createMockCommand(name: string, handler: (args: string[]) => void): MockCommand {
  return { name, handler };
}

export function createMockCvarRegistry(initialCvars?: Record<string, string>): CvarRegistry {
  return { ...initialCvars };
}
