import { BinaryStream } from '@quake2ts/shared';
import { BspEntity, parseEntLump, serializeEntLump } from '@quake2ts/engine';

/**
 * Replace entity lump in BSP file without recompilation
 * @param bspData Original BSP file
 * @param entities New entity list
 * @returns Modified BSP file
 */
export function replaceBspEntities(
  bspData: Uint8Array,
  entities: BspEntity[]
): Uint8Array {
  // Use BinaryStream which is the exported class from @quake2ts/shared

  // Cast buffer to ArrayBuffer to satisfy TS if needed, though Uint8Array.buffer is ArrayBufferLike
  // and BinaryStream accepts ArrayBuffer | Uint8Array.
  // The error says Argument of type 'ArrayBufferLike' is not assignable to 'ArrayBuffer | Uint8Array'.
  // This is because bspData.buffer is ArrayBufferLike (could be SharedArrayBuffer).
  // We can pass the Uint8Array directly.
  const reader = new BinaryStream(bspData);

  // Read BSP Header
  const magic = reader.readLong();
  const version = reader.readLong();

  if (magic !== 0x50534249 || version !== 38) { // IBSP version 38
    throw new Error('Invalid BSP file');
  }

  // Entities lump is index 0
  const LUMP_ENTITIES = 0;

  const lumps: { offset: number, length: number }[] = [];
  for (let i = 0; i < 19; i++) {
    lumps.push({
      offset: reader.readLong(),
      length: reader.readLong()
    });
  }

  const entitiesLump = lumps[LUMP_ENTITIES];

  // Serialize new entities
  const newEntitiesText = serializeEntLump(entities);
  const encoder = new TextEncoder();
  const newEntitiesData = encoder.encode(newEntitiesText);

  // Pad with null terminator
  const newEntitiesBuffer = new Uint8Array(newEntitiesData.length + 1);
  newEntitiesBuffer.set(newEntitiesData);
  newEntitiesBuffer[newEntitiesData.length] = 0;

  const lengthDiff = newEntitiesBuffer.length - entitiesLump.length;

  // Create new BSP buffer
  const newBspLength = bspData.length + lengthDiff;
  const newBsp = new Uint8Array(newBspLength);

  // Sorting lumps to handle file layout safely

  const entOffset = entitiesLump.offset;
  const entEnd = entOffset + entitiesLump.length;

  // Copy everything up to entOffset
  newBsp.set(bspData.subarray(0, entOffset), 0);

  // Copy new entity data
  newBsp.set(newEntitiesBuffer, entOffset);

  // Copy everything after the old entity lump
  if (entEnd < bspData.length) {
      newBsp.set(bspData.subarray(entEnd), entOffset + newEntitiesBuffer.length);
  }

  // Update lump table
  const view = new DataView(newBsp.buffer);

  // Update Entities Lump (Index 0)
  view.setInt32(8, entOffset, true);
  view.setInt32(12, newEntitiesBuffer.length, true);

  // Update all other lumps that are located after the entities lump
  for (let i = 0; i < 19; i++) {
    if (i === LUMP_ENTITIES) continue;

    const originalOffset = lumps[i].offset;

    if (originalOffset >= entEnd) {
      // Shift forward/backward
      const newOffset = originalOffset + lengthDiff;
      view.setInt32(4 + 4 + (i * 8), newOffset, true);
    }
  }

  return newBsp;
}
