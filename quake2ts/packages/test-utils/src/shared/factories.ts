import { Cvar, type ConfigStringEntry } from '@quake2ts/engine';
import { CvarFlags } from '@quake2ts/shared';

// Re-export Cvar for convenience if needed, but the factory returns Cvar instance
export { Cvar } from '@quake2ts/engine';
export type { ConfigStringEntry } from '@quake2ts/engine';

export function createConfigStringMock(index: number, value: string): ConfigStringEntry {
  return { index, value };
}

export function createConfigStringArrayMock(entries?: Record<number, string>): ConfigStringEntry[] {
  const result: ConfigStringEntry[] = [];
  if (entries) {
    for (const [key, value] of Object.entries(entries)) {
      result.push({ index: Number(key), value });
    }
  }
  return result;
}

export function createCvarMock(name: string, value: string, flags: number = CvarFlags.None): Cvar {
  // We instantiate a real Cvar because it encapsulates logic (latched, default value, etc.)
  // effectively acting as its own mock/implementation for testing purposes.
  return new Cvar({
    name,
    defaultValue: value,
    flags,
  });
}
