import { type Vec3 } from '@quake2ts/shared';

export interface MapEntity {
  classname: string;
  properties: Record<string, string>;
  brushes?: MapBrushDef[];
}

export interface MapBrushDef {
  sides: MapBrushSide[];
}

export interface MapBrushSide {
  plane: [Vec3, Vec3, Vec3];  // Three points defining plane
  texture: string;
  offsetX: number;
  offsetY: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
}

export function writeMapFile(entities: MapEntity[]): string {
  let output = '';

  for (const entity of entities) {
    output += '{\n';

    // Write classname first
    output += `"classname" "${entity.classname}"\n`;

    // Write properties
    for (const [key, value] of Object.entries(entity.properties)) {
      output += `"${key}" "${value}"\n`;
    }

    // Write brushes
    if (entity.brushes) {
      for (const brush of entity.brushes) {
        output += '{\n';
        for (const side of brush.sides) {
          const p1 = side.plane[0];
          const p2 = side.plane[1];
          const p3 = side.plane[2];

          output += `( ${p1.x} ${p1.y} ${p1.z} ) `;
          output += `( ${p2.x} ${p2.y} ${p2.z} ) `;
          output += `( ${p3.x} ${p3.y} ${p3.z} ) `;
          output += `${side.texture} ${side.offsetX} ${side.offsetY} ${side.rotation} ${side.scaleX} ${side.scaleY}\n`;
        }
        output += '}\n';
      }
    }

    output += '}\n';
  }

  return output;
}

export function createBoxBrush(origin: Vec3, size: Vec3, texture: string = 'common/caulk'): MapBrushDef {
  const minX = origin.x;
  const minY = origin.y;
  const minZ = origin.z;
  const maxX = origin.x + size.x;
  const maxY = origin.y + size.y;
  const maxZ = origin.z + size.z;

  // 6 sides of a box
  // Order matters for normals (CW order from outside)
  // Format: ( x1 y1 z1 ) ( x2 y2 z2 ) ( x3 y3 z3 )

  const sides: MapBrushSide[] = [];

  const addSide = (p1: Vec3, p2: Vec3, p3: Vec3) => {
    sides.push({
      plane: [p1, p2, p3],
      texture,
      offsetX: 0,
      offsetY: 0,
      rotation: 0,
      scaleX: 1,
      scaleY: 1
    });
  };

  // +Z (Top)
  // (minX, minY) -> (maxX, minY) -> (maxX, maxY)
  addSide(
    { x: minX, y: minY, z: maxZ },
    { x: maxX, y: minY, z: maxZ },
    { x: maxX, y: maxY, z: maxZ }
  );

  // -Z (Bottom)
  // (minX, minY) -> (maxX, maxY) -> (maxX, minY)
  addSide(
    { x: minX, y: minY, z: minZ },
    { x: maxX, y: maxY, z: minZ },
    { x: maxX, y: minY, z: minZ }
  );

  // +X (Right)
  // (maxY, maxZ) -> (minY, maxZ) -> (maxY, minZ)
  addSide(
    { x: maxX, y: maxY, z: maxZ },
    { x: maxX, y: minY, z: maxZ },
    { x: maxX, y: maxY, z: minZ }
  );

  // -X (Left)
  // (minY, maxZ) -> (maxY, maxZ) -> (minY, minZ)
  addSide(
    { x: minX, y: minY, z: maxZ },
    { x: minX, y: maxY, z: maxZ },
    { x: minX, y: minY, z: minZ }
  );

  // +Y (Front)
  // (minX, maxZ) -> (maxX, maxZ) -> (minX, minZ)
  addSide(
    { x: minX, y: maxY, z: maxZ },
    { x: maxX, y: maxY, z: maxZ },
    { x: minX, y: maxY, z: minZ }
  );

  // -Y (Back)
  // (maxX, maxZ) -> (minX, maxZ) -> (maxX, minZ)
  addSide(
    { x: maxX, y: minY, z: maxZ },
    { x: minX, y: minY, z: maxZ },
    { x: maxX, y: minY, z: minZ }
  );

  return { sides };
}

export function createHollowBox(origin: Vec3, size: Vec3, wallThickness: number, texture: string = 'common/caulk'): MapBrushDef[] {
  const brushes: MapBrushDef[] = [];

  // Outer dimensions
  const minX = origin.x;
  const minY = origin.y;
  const minZ = origin.z;
  const maxX = origin.x + size.x;
  const maxY = origin.y + size.y;
  const maxZ = origin.z + size.z;

  // Inner dimensions
  const iMinX = minX + wallThickness;
  const iMinY = minY + wallThickness;
  const iMinZ = minZ + wallThickness;
  const iMaxX = maxX - wallThickness;
  const iMaxY = maxY - wallThickness;
  const iMaxZ = maxZ - wallThickness;

  // Helper to create a wall
  const createWall = (mins: Vec3, maxs: Vec3) => {
    brushes.push(createBoxBrush(mins, { x: maxs.x - mins.x, y: maxs.y - mins.y, z: maxs.z - mins.z }, texture));
  };

  // Floor
  createWall({ x: minX, y: minY, z: minZ }, { x: maxX, y: maxY, z: iMinZ });
  // Ceiling
  createWall({ x: minX, y: minY, z: iMaxZ }, { x: maxX, y: maxY, z: maxZ });
  // Left Wall (-X)
  createWall({ x: minX, y: minY, z: iMinZ }, { x: iMinX, y: maxY, z: iMaxZ });
  // Right Wall (+X)
  createWall({ x: iMaxX, y: minY, z: iMinZ }, { x: maxX, y: maxY, z: iMaxZ });
  // Back Wall (-Y)
  createWall({ x: iMinX, y: minY, z: iMinZ }, { x: iMaxX, y: iMinY, z: iMaxZ });
  // Front Wall (+Y)
  createWall({ x: iMinX, y: iMaxY, z: iMinZ }, { x: iMaxX, y: maxY, z: iMaxZ });

  return brushes;
}
