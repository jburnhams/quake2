import { createBoxBrush, type MapEntity, type MapBrushDef } from '../mapWriter.js';

export function createCorridor(size = 512, width = 128, height = 128, thickness = 16): MapEntity[] {
  // L-Shape Corridor
  // Leg 1 (Horizontal): 0 to size along X, 0 to width along Y
  // Leg 2 (Vertical): size-width to size along X, width to size along Y

  const brushes: MapBrushDef[] = [];
  const texture = 'common/caulk';

  const minX = 0;
  const maxX = size;
  const minY = 0;
  const maxY = size;

  const innerX = size - width;
  const innerY = width;

  const floorZ = 0;
  const ceilZ = height - thickness;
  const wallZ = thickness;
  const wallH = height - 2 * thickness;

  // Floor 1 (Full X length)
  brushes.push(createBoxBrush(
    { x: minX, y: minY, z: floorZ },
    { x: maxX, y: width, z: thickness },
    texture
  ));

  // Floor 2 (Vertical part)
  brushes.push(createBoxBrush(
    { x: innerX, y: innerY, z: floorZ },
    { x: width, y: maxY - innerY, z: thickness },
    texture
  ));

  // Ceiling 1
  brushes.push(createBoxBrush(
    { x: minX, y: minY, z: ceilZ },
    { x: maxX, y: width, z: thickness },
    texture
  ));

  // Ceiling 2
  brushes.push(createBoxBrush(
    { x: innerX, y: innerY, z: ceilZ },
    { x: width, y: maxY - innerY, z: thickness },
    texture
  ));

  // Walls

  // 1. South Wall (-Y) - Full length
  brushes.push(createBoxBrush(
    { x: minX, y: minY, z: wallZ },
    { x: maxX, y: thickness, z: wallH },
    texture
  ));

  // 2. East Wall (+X) - Full height (offset by south wall thickness)
  brushes.push(createBoxBrush(
    { x: maxX - thickness, y: minY + thickness, z: wallZ },
    { x: thickness, y: maxY - (minY + thickness), z: wallH },
    texture
  ));

  // 3. North Wall (+Y) - Top of Leg 2
  brushes.push(createBoxBrush(
    { x: innerX, y: maxY - thickness, z: wallZ },
    { x: width - thickness, y: thickness, z: wallH }, // width - EastWall thickness
    texture
  ));

  // 4. West Wall Leg 2 (-X)
  brushes.push(createBoxBrush(
    { x: innerX, y: innerY, z: wallZ },
    { x: thickness, y: maxY - thickness - innerY, z: wallH },
    texture
  ));

  // 5. North Wall Leg 1 (+Y) - Inner corner
  brushes.push(createBoxBrush(
    { x: minX, y: innerY - thickness, z: wallZ },
    { x: innerX, y: thickness, z: wallH },
    texture
  ));

  // 6. West Wall Leg 1 (-X)
  brushes.push(createBoxBrush(
    { x: minX, y: minY + thickness, z: wallZ },
    { x: thickness, y: innerY - thickness - (minY + thickness), z: wallH },
    texture
  ));

  return [{
    classname: 'worldspawn',
    properties: { message: 'Test Corridor' },
    brushes
  }, {
    classname: 'info_player_start',
    properties: { origin: '64 64 32' }
  }];
}
