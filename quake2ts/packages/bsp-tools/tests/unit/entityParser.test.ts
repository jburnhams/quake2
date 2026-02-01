import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MapTokenizer, TokenType } from '../../src/parser/tokenizer';
import { parseEntity, parseKeyValue } from '../../src/parser/entityParser';
import * as brushParser from '../../src/parser/brushParser';

vi.mock('../../src/parser/brushParser', () => ({
  parseBrush: vi.fn(),
}));

describe('EntityParser', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // Default behavior for parseBrush: throw error as if it's the real stub
    (brushParser.parseBrush as any).mockImplementation(() => {
      throw new Error('parseBrush not implemented yet');
    });
  });

  describe('parseKeyValue', () => {
    it('should parse standard key-value pair', () => {
      const input = '"classname" "worldspawn"';
      const tokenizer = new MapTokenizer(input);
      const kv = parseKeyValue(tokenizer);
      expect(kv).toEqual({ key: 'classname', value: 'worldspawn' });
    });

    it('should parse key-value pair with numbers', () => {
      const input = '"light" "100"';
      const tokenizer = new MapTokenizer(input);
      const kv = parseKeyValue(tokenizer);
      expect(kv).toEqual({ key: 'light', value: '100' });
    });

    it('should handle unquoted values', () => {
       // "light" 100 -> key: "light", value: "100" (from NUMBER token value)
       const input = '"light" 100';
       const tokenizer = new MapTokenizer(input);
       const kv = parseKeyValue(tokenizer);
       expect(kv).toEqual({ key: 'light', value: '100' });
    });
  });

  describe('parseEntity', () => {
    it('should parse entity with properties', () => {
      const input = `{
"classname" "info_player_start"
"origin" "0 0 0"
}`;
      const tokenizer = new MapTokenizer(input);
      const entity = parseEntity(tokenizer);

      expect(entity.classname).toBe('info_player_start');
      expect(entity.properties.get('origin')).toBe('0 0 0');
      expect(entity.brushes).toHaveLength(0);
    });

    it('should parse entity with mixed properties', () => {
       const input = `{
"classname" "light"
"light" 300
"style" 0
}`;
       const tokenizer = new MapTokenizer(input);
       const entity = parseEntity(tokenizer);

       expect(entity.classname).toBe('light');
       expect(entity.properties.get('light')).toBe('300');
       expect(entity.properties.get('style')).toBe('0');
    });

    it('should fail on missing braces', () => {
       const input = `"classname" "test"`;
       const tokenizer = new MapTokenizer(input);
       expect(() => parseEntity(tokenizer)).toThrow(/Expected token type OPEN_BRACE/);
    });

    it('should fail if brushes present (stub implementation)', () => {
       const input = `{
"classname" "worldspawn"
{
( 0 0 0 ) ( 1 0 0 ) ( 0 1 0 ) tex 0 0 0 1 1
}
}`;
       const tokenizer = new MapTokenizer(input);
       // parseBrush throws 'not implemented' by default in our mock setup
       expect(() => parseEntity(tokenizer)).toThrow('parseBrush not implemented yet');
    });

    it('should parse entity with brushes (mocked)', () => {
      const input = `{
"classname" "worldspawn"
{
( 0 0 0 ) ( 1 0 0 ) ( 0 1 0 ) tex 0 0 0 1 1
}
}`;
      const tokenizer = new MapTokenizer(input);

      const mockBrush = { sides: [], line: 3 };
      (brushParser.parseBrush as any).mockImplementation((t: MapTokenizer) => {
        // Mock must consume tokens to prevent infinite loop in parser
        let token = t.next(); // Consume '{'
        while (token.type !== TokenType.CLOSE_BRACE && token.type !== TokenType.EOF) {
          token = t.next();
        }
        return mockBrush;
      });

      const entity = parseEntity(tokenizer);

      expect(entity.classname).toBe('worldspawn');
      expect(entity.brushes).toHaveLength(1);
      expect(entity.brushes[0]).toBe(mockBrush);
      expect(brushParser.parseBrush).toHaveBeenCalled();
    });
  });
});
