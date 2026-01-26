import { describe, expect, it } from 'vitest';
import { parseRereleaseSave, summarizeRereleaseSave } from '../../../src/save/index.js';

describe('rerelease save format inspection', () => {
  it('parses game saves with client counts that match the rerelease rules', () => {
    const gameSave = {
      save_version: 1,
      game: {
        maxclients: 2,
        maxentities: 64,
        mapname: 'base1',
      },
      clients: [
        { pers: { netname: 'player1', health: 100 } },
        { pers: { netname: 'player2', health: 100 } },
      ],
    } as const;

    const parsed = parseRereleaseSave(gameSave);
    expect(parsed.saveVersion).toBe(1);
    expect('game' in parsed).toBe(true);
    expect(parsed.clients).toHaveLength(2);
    expect(parsed.game.maxclients).toBe(2);

    const summary = summarizeRereleaseSave(gameSave);
    expect(summary).toEqual({ version: 1, kind: 'game', maxClients: 2, clientCount: 2 });
  });

  it('parses level saves with sparse entity indexes', () => {
    const levelSave = {
      save_version: 1,
      level: {
        time: 4.5,
        mapname: 'fact1',
      },
      entities: {
        '0': { classname: 'worldspawn', inuse: true },
        '2': { classname: 'info_player_start', inuse: true },
        '7': { classname: 'monster_soldier', inuse: true },
      },
    } as const;

    const parsed = parseRereleaseSave(levelSave);
    expect('level' in parsed).toBe(true);
    expect(parsed.entities.size).toBe(3);
    expect(parsed.entities.get(2)?.classname).toBe('info_player_start');

    const summary = summarizeRereleaseSave(levelSave);
    expect(summary).toEqual({ version: 1, kind: 'level', entityCount: 3, highestEntityIndex: 7 });
  });

  it('mirrors rerelease validation for conflicting shapes and lengths', () => {
    expect(() => parseRereleaseSave({ save_version: 1 })).toThrow();
    expect(() => parseRereleaseSave({ save_version: 1, game: {}, level: {} })).toThrow('either game or level');
    expect(() =>
      parseRereleaseSave({ save_version: 1, game: { maxclients: 1 }, clients: [{}, {}] }),
    ).toThrow('does not match');
    expect(() => parseRereleaseSave({ save_version: 1, level: {}, entities: { foo: {} } })).toThrow('integer');
    expect(() => parseRereleaseSave({ save_version: 'latest' })).toThrow('save_version');
  });
});
