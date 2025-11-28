
/**
 * Helper to force a number into a signed 16-bit integer range (-32768 to 32767).
 * This mimics the behavior of casting to `short` in C++.
 */
function toSigned16(val: number): number {
  return (val << 16) >> 16;
}

/**
 * Reads a 16-bit integer (unsigned) from the stats array at the given byte offset.
 * Mimics reading `*(uint16_t*)((uint8_t*)stats + byteOffset)` in Little Endian.
 */
function readUint16LE(stats: number[], startIndex: number, byteOffset: number): number {
  // Determine which element(s) of the array we are accessing
  // stats is int16[], so each element is 2 bytes.
  // absolute byte offset from stats[startIndex]
  const elementIndex = Math.floor(byteOffset / 2);
  const isOdd = (byteOffset % 2) !== 0;

  // Access the array at the calculated index relative to startIndex
  const index = startIndex + elementIndex;

  // Read the primary element
  const val0 = stats[index] || 0; // Handle potentially undefined/uninitialized slots as 0

  if (!isOdd) {
    // Aligned access: just return the element as uint16
    return val0 & 0xFFFF;
  } else {
    // Unaligned access: High byte of val0 + Low byte of val1
    const val1 = stats[index + 1] || 0;

    // Low byte of result comes from High byte of val0
    const low = (val0 >>> 8) & 0xFF;
    // High byte of result comes from Low byte of val1
    const high = val1 & 0xFF;

    return (high << 8) | low;
  }
}

/**
 * Writes a 16-bit integer to the stats array at the given byte offset.
 * Mimics writing `*(uint16_t*)((uint8_t*)stats + byteOffset) = value` in Little Endian.
 */
function writeUint16LE(stats: number[], startIndex: number, byteOffset: number, value: number): void {
  const elementIndex = Math.floor(byteOffset / 2);
  const isOdd = (byteOffset % 2) !== 0;
  const index = startIndex + elementIndex;

  // Ensure array has values at these indices to avoid NaN math
  if (stats[index] === undefined) stats[index] = 0;

  if (!isOdd) {
    // Aligned access: overwrite the element
    stats[index] = toSigned16(value);
  } else {
    // Unaligned access
    if (stats[index + 1] === undefined) stats[index + 1] = 0;

    const val0 = stats[index];
    const val1 = stats[index + 1];

    // We want to write `value` (which is Low byte `L_v` and High byte `H_v`)
    // into the bytes at `byteOffset` and `byteOffset + 1`.

    // Byte at `byteOffset` corresponds to High byte of `stats[index]`.
    // It should become `value & 0xFF` (L_v).
    // So `stats[index]` becomes `(Old_Low) | (L_v << 8)`.
    const newHigh0 = value & 0xFF;
    const newVal0 = (val0 & 0xFF) | (newHigh0 << 8);
    stats[index] = toSigned16(newVal0);

    // Byte at `byteOffset + 1` corresponds to Low byte of `stats[index+1]`.
    // It should become `(value >> 8) & 0xFF` (H_v).
    // So `stats[index+1]` becomes `(H_v) | (Old_High << 8)`.
    const newLow1 = (value >>> 8) & 0xFF;
    const newVal1 = newLow1 | (val1 & 0xFF00);
    stats[index + 1] = toSigned16(newVal1);
  }
}

/**
 * Packs a value into the stats array using a specific bit width.
 * Equivalent to C++ `set_compressed_integer`.
 *
 * @param stats The stats array (number[] representing int16s)
 * @param startIndex The index in the stats array where the packed region begins (e.g. STAT_AMMO_INFO_START)
 * @param id The ID of the item to set (0-based index within the packed region)
 * @param count The value to set
 * @param bitsPerValue Number of bits per item (e.g. 9 for ammo, 2 for powerups)
 */
export function setCompressedInteger(
  stats: number[],
  startIndex: number,
  id: number,
  count: number,
  bitsPerValue: number
): void {
  const bitOffset = bitsPerValue * id;
  const byteOffset = Math.floor(bitOffset / 8);
  const bitShift = bitOffset % 8;
  const mask = ((1 << bitsPerValue) - 1) << bitShift;

  // Read the 16-bit word at the target byte address
  let base = readUint16LE(stats, startIndex, byteOffset);

  // Apply the mask and value
  // Note: (count << bitShift) might overflow 16 bits if we aren't careful,
  // but the mask will handle the high bits.
  // However, in JS, bitwise ops are 32-bit.
  // We need to ensure we only write back 16 bits.

  const valueToWrite = (base & ~mask) | ((count << bitShift) & mask);

  // Write the modified 16-bit word back
  writeUint16LE(stats, startIndex, byteOffset, valueToWrite & 0xFFFF);
}

/**
 * Unpacks a value from the stats array.
 * Equivalent to C++ `get_compressed_integer`.
 */
export function getCompressedInteger(
  stats: number[],
  startIndex: number,
  id: number,
  bitsPerValue: number
): number {
  const bitOffset = bitsPerValue * id;
  const byteOffset = Math.floor(bitOffset / 8);
  const bitShift = bitOffset % 8;
  const mask = ((1 << bitsPerValue) - 1) << bitShift;

  const base = readUint16LE(stats, startIndex, byteOffset);

  return (base & mask) >>> bitShift;
}
