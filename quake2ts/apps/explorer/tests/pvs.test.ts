// @vitest-environment node
import { beforeAll, describe, expect, it } from 'vitest';
import { parseBsp, type BspMap } from '@quake2ts/formats';
import { Library } from '../src/library/library';
import { worldFromMap, type LabWorld } from '../src/labs/world';
import { floorHeight, mapFloors, mapPortals, viewFrom, type Floor } from '../src/labs/pvs/pvs';
import { demoPak } from './setup';

let map: BspMap;
let world: LabWorld;
let floors: Floor[];
beforeAll(async () => {
  const library = new Library();
  library.mount('pak.pak', demoPak.buffer.slice(demoPak.byteOffset, demoPak.byteOffset + demoPak.byteLength) as ArrayBuffer);
  map = parseBsp(await library.read('maps/demo1.bsp'));
  world = worldFromMap(map);
  floors = mapFloors(map);
});

const eyeAtStart = () => ({ ...world.start.origin, z: world.start.origin.z + 22 });

// The PVS lab's view: which of demo1's floors the port's renderer draws from an eye.
describe('PVS lab view', () => {
  it('finds demo1 floors that face up, lowest first, with the height under a point', () => {
    expect(floors.length).toBeGreaterThan(500);
    expect(floors.every((f, i) => i === 0 || f.top >= floors[i - 1]!.top)).toBe(true);
    const f = floors.find((x) => x.plane.normal.z > 0.999)!;
    const [x, y] = f.points[0]!;
    expect(floorHeight(f, x, y)).toBeCloseTo(f.top, 0);
  });

  it("names the door that opens demo1's one area portal", () => {
    expect(mapPortals(map)).toEqual([{ number: 1, door: '*8' }]);
  });

  it('draws a part of the level from the start, its own cluster among it', () => {
    const v = viewFrom(map, floors, eyeAtStart(), new Set());
    expect(v.cluster).toBeGreaterThanOrEqual(0);
    expect(v.clustersSeen).toBeGreaterThan(1);
    expect(v.clustersSeen).toBeLessThan(v.clusters / 2);
    expect(v.facesDrawn).toBeLessThan(v.worldFaces / 2);
    const fates = [...v.fate.values()];
    expect(fates).toContain('here');
    expect(fates).toContain('drawn');
    expect(fates).toContain('hidden');
  });

  it('culls what lies past a closed door that the PVS alone would draw, and draws it once the door opens', () => {
    // Every floor in the second area (behind door *8): look from the floors around it until one sees through.
    const seesDoor = floors
      .map((f) => {
        const [x, y] = f.points[0]!;
        return { x: x + 0.5, y: y + 0.5, z: f.top + 46 };
      })
      .map((eye) => viewFrom(map, floors, eye, new Set()))
      .find((v) => v.facesBehindDoors > 0)!;
    expect(seesDoor).toBeDefined();
    const opened = viewFrom(map, floors, seesDoor.eye, new Set([1]));
    expect(opened.facesBehindDoors).toBe(0);
    expect(opened.facesDrawn).toBe(seesDoor.facesDrawn + seesDoor.facesBehindDoors);
    expect([...seesDoor.fate.values()]).toContain('door');
  });
});
