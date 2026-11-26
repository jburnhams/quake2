import { createHollowBox, createBoxBrush, type MapEntity, type MapBrushDef } from '../mapWriter.js';

export function createMultiRoom(roomSize = 512, doorWidth = 128, doorHeight = 128, wallThickness = 16): MapEntity[] {
  const brushes: MapBrushDef[] = [];
  const texture = 'common/caulk';

  // Room 1: 0 to roomSize
  // Room 2: roomSize + wallThickness to 2*roomSize + wallThickness
  // Shared Wall: roomSize to roomSize + wallThickness

  // Actually, let's just use createHollowBox for the rooms but we need to remove the shared walls.
  // Since createHollowBox returns a list and we know the order (Floor, Ceiling, Left, Right, Back, Front),
  // we can filter them.
  // Order in createHollowBox: Floor, Ceiling, Left(-X), Right(+X), Back(-Y), Front(+Y).

  const room1Origin = { x: 0, y: 0, z: 0 };
  const room1Size = { x: roomSize, y: roomSize, z: roomSize/2 }; // 256 height

  // Room 1 brushes
  // 0: Floor, 1: Ceiling, 2: -X, 3: +X (Right), 4: -Y, 5: +Y
  const r1Brushes = createHollowBox(room1Origin, room1Size, wallThickness, texture);

  // Remove +X wall (index 3)
  const room1WithoutRightWall = r1Brushes.filter((_, i) => i !== 3);
  brushes.push(...room1WithoutRightWall);

  const room2Origin = { x: roomSize, y: 0, z: 0 }; // Overlap the wall space?
  // Let's make Room 2 start where Room 1 ends.
  // If we want a shared wall of thickness 16.
  // Room 1 is 0..512. The wall would be at 512-16..512 if it was inside.
  // But we removed it.

  // Let's explicitly define the "Divider Wall" at X = roomSize - wallThickness (inside Room 1 space)
  // or use a separate wall structure.

  // Let's align Room 2 to start at roomSize.
  const r2Brushes = createHollowBox(room2Origin, room1Size, wallThickness, texture);
  // Remove -X wall (index 2)
  const room2WithoutLeftWall = r2Brushes.filter((_, i) => i !== 2);
  brushes.push(...room2WithoutLeftWall);

  // Now create the divider wall with a doorway.
  // Location: X = roomSize - wallThickness/2?
  // Let's put it exactly at roomSize - wallThickness to roomSize (matching Room 1's original wall)
  // AND roomSize to roomSize + wallThickness (matching Room 2's original wall)?
  // That would be a double thick wall.
  // Let's just create one wall of thickness `wallThickness * 2` centered at `roomSize`.

  const wallX = roomSize - wallThickness;
  const thick = wallThickness * 2;
  const wallY = 0;
  const height = room1Size.z;
  const width = roomSize; // Y width

  // Doorway centered in Y
  const doorY = (width - doorWidth) / 2;

  // Wall Parts
  // 1. Left of door (Y < doorY)
  brushes.push(createBoxBrush(
    { x: wallX, y: wallY + wallThickness, z: wallThickness }, // +thickness because floor/walls
    { x: thick, y: doorY - wallThickness, z: height - 2*wallThickness },
    texture
  ));

  // 2. Right of door (Y > doorY + doorWidth)
  brushes.push(createBoxBrush(
    { x: wallX, y: wallY + doorY + doorWidth, z: wallThickness },
    { x: thick, y: width - (doorY + doorWidth) - wallThickness, z: height - 2*wallThickness },
    texture
  ));

  // 3. Above door
  brushes.push(createBoxBrush(
    { x: wallX, y: wallY + doorY, z: doorHeight },
    { x: thick, y: doorWidth, z: height - doorHeight - wallThickness },
    texture
  ));

  // (Floor and ceiling already cover the gap because we kept them in r1Brushes/r2Brushes?
  // r1 Floor: 0 to 512. r2 Floor: 512 to 1024.
  // They meet at 512. Perfect.
  // Wait, r1Brushes floor goes to inner wall?
  // createHollowBox implementation:
  // Floor: createWall({ x: minX, y: minY, z: minZ }, { x: maxX, y: maxY, z: iMinZ });
  // It goes full width/height. So yes, they meet at 512.

  return [{
    classname: 'worldspawn',
    properties: { message: 'Test Multi Room' },
    brushes
  }, {
    classname: 'info_player_start',
    properties: { origin: '64 64 32' }
  }];
}
