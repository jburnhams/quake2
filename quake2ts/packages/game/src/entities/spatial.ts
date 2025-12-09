import { Entity } from './entity.js';
import { Vec3 } from '@quake2ts/shared';

const CELL_SIZE = 256;

function getCellKey(x: number, y: number, z: number): string {
  return `${x},${y},${z}`;
}

export class SpatialGrid {
  private cells = new Map<string, Set<Entity>>();
  private entityCells = new Map<Entity, string[]>();

  constructor(private cellSize: number = CELL_SIZE) {}

  private getCellRange(min: number, max: number): [number, number] {
    return [Math.floor(min / this.cellSize), Math.floor(max / this.cellSize)];
  }

  insert(entity: Entity): void {
    if (this.entityCells.has(entity)) {
      this.remove(entity);
    }

    const [minX, maxX] = this.getCellRange(entity.absmin.x, entity.absmax.x);
    const [minY, maxY] = this.getCellRange(entity.absmin.y, entity.absmax.y);
    const [minZ, maxZ] = this.getCellRange(entity.absmin.z, entity.absmax.z);

    const keys: string[] = [];

    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        for (let z = minZ; z <= maxZ; z++) {
          const key = getCellKey(x, y, z);
          let cell = this.cells.get(key);
          if (!cell) {
            cell = new Set<Entity>();
            this.cells.set(key, cell);
          }
          cell.add(entity);
          keys.push(key);
        }
      }
    }

    this.entityCells.set(entity, keys);
  }

  remove(entity: Entity): void {
    const keys = this.entityCells.get(entity);
    if (!keys) return;

    for (const key of keys) {
      const cell = this.cells.get(key);
      if (cell) {
        cell.delete(entity);
        if (cell.size === 0) {
          this.cells.delete(key);
        }
      }
    }

    this.entityCells.delete(entity);
  }

  update(entity: Entity): void {
    this.insert(entity);
  }

  query(mins: Vec3, maxs: Vec3): Entity[] {
    const [minX, maxX] = this.getCellRange(mins.x, maxs.x);
    const [minY, maxY] = this.getCellRange(mins.y, maxs.y);
    const [minZ, maxZ] = this.getCellRange(mins.z, maxs.z);

    const results = new Set<Entity>();

    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        for (let z = minZ; z <= maxZ; z++) {
          const key = getCellKey(x, y, z);
          const cell = this.cells.get(key);
          if (cell) {
            for (const entity of cell) {
              results.add(entity);
            }
          }
        }
      }
    }

    return Array.from(results);
  }

  clear(): void {
    this.cells.clear();
    this.entityCells.clear();
  }
}
