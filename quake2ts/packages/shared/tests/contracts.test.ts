import { describe, expect, it } from 'vitest';
import {
  assertContract,
  CGAME_EXPORT_KEYS,
  CGAME_IMPORT_KEYS,
  GAME_EXPORT_KEYS,
  GAME_IMPORT_KEYS,
  validateContract,
} from '../src/protocol/contracts.js';

function stubFunctions(keys: readonly string[]): Record<string, unknown> {
  return Object.fromEntries(keys.map((key) => [key, () => {}]));
}

describe('contract validators', () => {
  it('accepts a rerelease-accurate game import surface', () => {
    const table = { tick_rate: 40, frame_time_ms: 25, ...stubFunctions(GAME_IMPORT_KEYS) };
    const result = validateContract(table, GAME_IMPORT_KEYS, { name: 'game_import_t' });

    expect(result).toEqual({ missing: [], nonFunctions: [], extras: [] });
    expect(() => assertContract(table, GAME_IMPORT_KEYS, { name: 'game_import_t' })).not.toThrow();
  });

  it('detects missing entries and wrong types for exports', () => {
    const table = { Init: () => {}, Shutdown: () => {}, RunFrame: 123, unexpected: () => {} };
    const result = validateContract(table, GAME_EXPORT_KEYS, { name: 'game_export_t', allowExtra: false });

    expect(result.missing).toEqual(expect.arrayContaining(['PreInit', 'SpawnEntities', 'Pmove']));
    expect(result.nonFunctions).toEqual(['RunFrame']);
    expect(result.extras).toEqual(['unexpected']);
    expect(() => assertContract(table, GAME_EXPORT_KEYS, { name: 'game_export_t', allowExtra: false })).toThrow(
      /game_export_t validation failed/,
    );
  });

  it('verifies the client import/export scaffolding', () => {
    const clientImports = stubFunctions(CGAME_IMPORT_KEYS);
    const clientExports = stubFunctions(CGAME_EXPORT_KEYS);

    expect(() => assertContract(clientImports, CGAME_IMPORT_KEYS, { name: 'cgame_import_t' })).not.toThrow();
    expect(() => assertContract(clientExports, CGAME_EXPORT_KEYS, { name: 'cgame_export_t' })).not.toThrow();
  });
});
