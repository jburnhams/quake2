// The demo player's timeline (labs/demo/timeline.ts) on the real recordings: the demo pak's
// demos/q2demo1.dm2 (3.14, protocol 31) read whole and lerped between frames, and the committed
// pak.pak's demo1.dm2 (3.00) refused with the parser's reason.
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PakArchive } from '@quake2ts/formats';
import { frameIndexAt, lerpAngle, readDemo, viewAt } from '../src/labs/demo/timeline';
import { demoPak } from './setup';

const FULL_PAK = resolve(import.meta.dirname, '../../../.paks/baseq2/pak0.pak');
const open = (bytes: Buffer) => PakArchive.fromArrayBuffer('pak', bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer);
const file = (pak: PakArchive, name: string) => {
  const data = pak.readFile(name);
  return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
};

describe.skipIf(!existsSync(FULL_PAK))('q2demo1.dm2', () => {
  const demo = readDemo(file(open(readFileSync(FULL_PAK)), 'demos/q2demo1.dm2'));

  it('is a minute on demo2, every frame rebuilt', () => {
    expect(demo.protocol).toBe(31);
    expect(demo.levelName).toBe('Installation');
    expect(demo.mapName).toBe('maps/demo2.bsp');
    expect(demo.viewer).toBe(1);
    expect(demo.frames).toHaveLength(632);
    expect(demo.duration).toBeCloseTo(63.1, 5);
    expect(demo.modelName(1)).toBe('maps/demo2.bsp');
    expect(demo.modelName(2)).toBe('*1');
    expect(demo.models).toContain('models/monsters/soldier/tris.md2');
    expect(demo.models).toContain('players/male/tris.md2'); // modelindex 255, from CS_PLAYERSKINS
    expect(demo.lightStyles.find(([s]) => s === 0)?.[1]).toBe('m');
  });

  it('lerps the view halfway between two frames', () => {
    const a = viewAt(demo, 10);
    const b = viewAt(demo, 10.1);
    const mid = viewAt(demo, 10.05);
    expect(mid.frame).toBe(a.frame);
    expect(mid.eye.x).toBeCloseTo((a.eye.x + b.eye.x) / 2, 3);
    expect(mid.eye.y).toBeCloseTo((a.eye.y + b.eye.y) / 2, 3);
    expect(mid.weapon?.model).toMatch(/^models\/weapons\/v_/);
    expect(mid.player.map((p) => p.modelindex)).toEqual([255, 255]); // the body and the weapon it holds
    expect(mid.entities.some((e) => demo.modelName(e.modelindex) === 'models/monsters/soldier/tris.md2')).toBe(true);
    expect(mid.health).toBeGreaterThan(0);
  });
});

describe('demo1.dm2 in the committed pak.pak', () => {
  it('is refused, saying which version it is', () => {
    expect(() => readDemo(file(open(demoPak), 'demos/demo1.dm2'))).toThrow(/3\.00 demos \(protocol 25\) are not supported/);
  });
});

describe('the timeline helpers', () => {
  it('finds the frame at or before a time', () => {
    const frames = [0, 0.1, 0.2, 0.4].map((time, i) => ({ time, serverFrame: i, entities: new Map(), player: {} as never }));
    expect(frameIndexAt(frames, -1)).toBe(0);
    expect(frameIndexAt(frames, 0.15)).toBe(1);
    expect(frameIndexAt(frames, 0.3)).toBe(2);
    expect(frameIndexAt(frames, 9)).toBe(3);
  });

  it('turns the short way round', () => {
    expect(lerpAngle(350, 10, 0.5)).toBeCloseTo(360);
    expect(lerpAngle(10, 350, 0.5)).toBeCloseTo(0);
    expect(lerpAngle(-170, 170, 0.5)).toBeCloseTo(-180);
  });
});
