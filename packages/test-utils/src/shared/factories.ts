import { Cvar, type ConfigStringEntry } from '@quake2ts/engine';
import { CvarFlags, PlayerState } from '@quake2ts/shared';

// Re-export Cvar for convenience if needed, but the factory returns Cvar instance
export { Cvar } from '@quake2ts/engine';
export type { ConfigStringEntry } from '@quake2ts/engine';

/**
 * Creates a mock ConfigStringEntry.
 *
 * @param index - The config string index.
 * @param value - The config string value.
 * @returns A ConfigStringEntry object.
 */
export function createConfigStringMock(index: number, value: string): ConfigStringEntry {
  return { index, value };
}

/**
 * Creates an array of ConfigStringEntry objects from a record.
 *
 * @param entries - A record of index-value pairs (optional).
 * @returns An array of ConfigStringEntry objects.
 */
export function createConfigStringArrayMock(entries?: Record<number, string>): ConfigStringEntry[] {
  const result: ConfigStringEntry[] = [];
  if (entries) {
    for (const [key, value] of Object.entries(entries)) {
      result.push({ index: Number(key), value });
    }
  }
  return result;
}

/**
 * Creates a mock Cvar.
 *
 * @param name - The name of the cvar.
 * @param value - The initial value of the cvar.
 * @param flags - Cvar flags (default: CvarFlags.None).
 * @returns A Cvar instance.
 */
export function createCvarMock(name: string, value: string, flags: number = CvarFlags.None): Cvar {
  // We instantiate a real Cvar because it encapsulates logic (latched, default value, etc.)
  // effectively acting as its own mock/implementation for testing purposes.
  return new Cvar({
    name,
    defaultValue: value,
    flags,
  });
}

/**
 * Creates a mock PlayerState with sensible defaults.
 * Corresponds to player_state_t in q_shared.h.
 *
 * @param overrides - Partial PlayerState to override defaults.
 * @returns A complete PlayerState object.
 */
export function createMockPlayerState(overrides?: Partial<PlayerState>): PlayerState {
  return {
    origin: { x: 0, y: 0, z: 0 },
    velocity: { x: 0, y: 0, z: 0 },
    viewAngles: { x: 0, y: 0, z: 0 },
    onGround: false,
    waterLevel: 0,
    watertype: 0,
    mins: { x: -16, y: -16, z: -24 },
    maxs: { x: 16, y: 16, z: 32 },
    damageAlpha: 0,
    damageIndicators: [],
    blend: [0, 0, 0, 0],
    stats: new Array(32).fill(0),
    kick_angles: { x: 0, y: 0, z: 0 },
    kick_origin: { x: 0, y: 0, z: 0 },
    gunoffset: { x: 0, y: 0, z: 0 },
    gunangles: { x: 0, y: 0, z: 0 },
    gunindex: 0,
    pm_type: 0,
    pm_time: 0,
    pm_flags: 0,
    gun_frame: 0,
    rdflags: 0,
    fov: 90,
    renderfx: 0,
    ...overrides
  };
}
