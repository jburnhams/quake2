import { describe, it, expect } from 'vitest';
import { replaceBspEntities } from '../../src/bspTools.js';
import { BspEntity, serializeEntLump } from '@quake2ts/engine';

describe('bspTools', () => {
  describe('replaceBspEntities', () => {
    it('should replace entities in a mock BSP', () => {
      // Construct a mock BSP file with minimal valid structure
      // Header: 4 bytes magic, 4 bytes version
      // Lumps: 19 * 8 bytes
      // Total header size: 8 + 152 = 160 bytes

      const headerSize = 160;
      const initialEntities = [{ properties: { classname: 'worldspawn', message: 'test' } }];
      const initialEntText = serializeEntLump(initialEntities);

      const encoder = new TextEncoder();
      const entData = encoder.encode(initialEntText);
      // Ensure null terminator
      const entBuffer = new Uint8Array(entData.length + 1);
      entBuffer.set(entData);
      entBuffer[entData.length] = 0;

      // Create BSP data
      // Just put entities immediately after header for simplicity
      const bspSize = headerSize + entBuffer.length;
      const bspData = new Uint8Array(bspSize);
      const view = new DataView(bspData.buffer);

      // Magic: IBSP (0x50534249)
      view.setInt32(0, 0x50534249, true);
      // Version: 38
      view.setInt32(4, 38, true);

      // Set Entities Lump (Index 0)
      // Offset = headerSize
      // Length = entBuffer.length
      view.setInt32(8, headerSize, true); // Offset
      view.setInt32(12, entBuffer.length, true); // Length

      // Copy entity data
      bspData.set(entBuffer, headerSize);

      // Now replace entities
      const newEntities = [
        { properties: { classname: 'worldspawn', message: 'replaced' } },
        { properties: { classname: 'info_player_start', origin: '0 0 0' } }
      ];

      const newBsp = replaceBspEntities(bspData, newEntities);

      // Verify new BSP
      const newView = new DataView(newBsp.buffer);
      expect(newView.getInt32(0, true)).toBe(0x50534249);
      expect(newView.getInt32(4, true)).toBe(38);

      const newEntOffset = newView.getInt32(8, true);
      const newEntLength = newView.getInt32(12, true);

      // Extract new entity text
      const newEntBuffer = newBsp.slice(newEntOffset, newEntOffset + newEntLength);
      // Remove null terminator for decoding
      const decoder = new TextDecoder();
      const newEntText = decoder.decode(newEntBuffer.slice(0, -1));

      expect(newEntText).toContain('"classname" "worldspawn"');
      expect(newEntText).toContain('"message" "replaced"');
      expect(newEntText).toContain('"classname" "info_player_start"');

      // Check length match roughly (serialize output might vary in whitespace)
      expect(newEntLength).toBeGreaterThan(entBuffer.length);
      expect(newBsp.length).toBe(headerSize + newEntLength);
    });

    it('should throw error for invalid BSP magic', () => {
      const bspData = new Uint8Array(160);
      expect(() => replaceBspEntities(bspData, [])).toThrow('Invalid BSP file');
    });
  });
});
