// What every lab runs in: a map the explorer parsed, its collision, and where a player starts.
// Read once per map and library version (a PAK opened later that overrides the map reads it
// again), and shared by the labs so the same map is never parsed twice.
import { useLoad, type Load } from 'strata-react';
import { parseBsp, type BspMap } from '@quake2ts/formats/bsp';
import type { CollisionModel } from '@quake2ts/shared/bsp/collision';
import { collisionModelFromBsp } from '@quake2ts/shared/bsp/fromBsp';
import { useDemoPak, useLibrary } from '../library/context';
import type { Vec } from './orbit';

/** The map every lab runs on. */
export const LAB_MAP = 'maps/demo1.bsp';

/** A map's collision and where a player starts in it. */
export interface LabWorld {
  readonly model: CollisionModel;
  readonly start: { readonly origin: Vec; readonly yaw: number };
}

/**
 * The world from a parsed map: its collision, and the spawn a new game uses (the
 * info_player_start with no targetname; one with a targetname is where a level change from
 * that level lands), else any player spawn, raised 9 units as SelectSpawnPoint does so the box
 * does not start in the floor.
 */
export function worldFromMap(map: BspMap): LabWorld {
  const spawns = map.entities.entities.filter((e) => e.classname?.startsWith('info_player_'));
  const starts = spawns.filter((e) => e.classname === 'info_player_start');
  const spot = starts.find((e) => !e.properties.targetname) ?? starts[0] ?? spawns[0];
  const [x, y, z] = (spot?.properties.origin ?? '0 0 0').split(/\s+/).map(Number);
  return {
    model: collisionModelFromBsp(map),
    start: { origin: { x: x ?? 0, y: y ?? 0, z: (z ?? 0) + 9 }, yaw: Number(spot?.properties.angle ?? 0) || 0 },
  };
}

/** The lab map, parsed with its world, or null when no open PAK has it. */
export function useLabMap(): Load<{ map: BspMap; world: LabWorld } | null> {
  const demo = useDemoPak();
  const { library, version } = useLibrary();
  return useLoad({
    queryKey: ['lab-world', version, LAB_MAP],
    enabled: demo.status !== 'loading',
    staleTime: Infinity,
    retry: false,
    queryFn: async () => {
      if (!library.vfs.hasFile(LAB_MAP)) return null;
      const map = parseBsp(await library.read(LAB_MAP));
      return { map, world: worldFromMap(map) };
    },
    describeError: (e) => `${LAB_MAP} could not be read: ${e instanceof Error ? e.message : String(e)}.`,
  });
}
