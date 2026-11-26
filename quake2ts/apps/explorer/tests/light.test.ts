// @vitest-environment node
import { beforeAll, describe, expect, it } from 'vitest';
import { parseBsp, type BspMap } from '@quake2ts/formats';
import { DEFAULT_LIGHT_STYLES } from '@quake2ts/shared';
import { Library } from '../src/library/library';
import { checkPattern, mapStyles, playPattern, MAX_PATTERN } from '../src/labs/light/light';
import { PLACES } from '../src/labs/light/LightLab';
import { demoPak } from './setup';

let map: BspMap;
beforeAll(async () => {
  const library = new Library();
  library.mount('pak.pak', demoPak.buffer.slice(demoPak.byteOffset, demoPak.byteOffset + demoPak.byteLength) as ArrayBuffer);
  map = parseBsp(await library.read('maps/demo1.bsp'));
});

// The light styles lab's facts about demo1, and its patterns.
describe('light styles lab', () => {
  it("finds demo1's styled faces and lights: a flicker (6) and a strobe (4), none switchable", () => {
    const s = mapStyles(map);
    expect([...s.faces.keys()]).toEqual([0, 4, 6]);
    expect(s.faces.get(6)).toBe(127);
    expect(s.faces.get(4)).toBe(39);
    expect(s.layered).toBe(127 + 39);
    expect(s.lights.map((l) => l.style).sort()).toEqual([4, 6, 6, 6]);
    expect(s.lights.some((l) => l.targetname)).toBe(false);
    for (const place of Object.values(PLACES)) expect(s.lights.some((l) => l.style === place.style)).toBe(true);
  });

  it('plays a pattern a letter a tenth, m as 1 and a as 0', () => {
    expect(playPattern('mamamamamama')).toEqual([1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0]);
    expect(playPattern(DEFAULT_LIGHT_STYLES.get(6)!.pattern)).toHaveLength(17);
    expect(playPattern('z')[0]).toBeCloseTo(25 / 12);
  });

  it('takes letters a to z only, up to the client limit', () => {
    expect(checkPattern(' MaZ ')).toEqual({ pattern: 'maz' });
    expect(checkPattern('')).toHaveProperty('error');
    expect(checkPattern('m1')).toHaveProperty('error');
    expect(checkPattern('a'.repeat(MAX_PATTERN))).toEqual({ pattern: 'a'.repeat(MAX_PATTERN) });
    expect(checkPattern('a'.repeat(MAX_PATTERN + 1))).toHaveProperty('error');
  });
});
