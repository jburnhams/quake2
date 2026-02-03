import { describe, it, expect, vi } from 'vitest';
import { MapParser } from '../../../src/parser/mapParser';
import { MapParseError } from '../../../src/parser/errors';

describe('MapParser', () => {
  describe('parse', () => {
    it('should parse a minimal valid map', () => {
      const input = `{
"classname" "worldspawn"
"mapversion" "220"
}`;
      const map = MapParser.parse(input);
      expect(map.entities).toHaveLength(1);
      expect(map.worldspawn.classname).toBe('worldspawn');
      expect(map.mapVersion).toBe(220);
    });

    it('should throw if map has no entities', () => {
      const input = ``;
      expect(() => MapParser.parse(input)).toThrow(MapParseError);
    });

    it('should throw if first entity is not worldspawn (strict)', () => {
      const input = `{
"classname" "info_player_start"
}`;
      expect(() => MapParser.parse(input, { strict: true })).toThrow(/First entity should be 'worldspawn'/);
    });

    it('should warn if first entity is not worldspawn (non-strict)', () => {
      const input = `{
"classname" "info_player_start"
}`;
      const onWarning = vi.fn();
      const map = MapParser.parse(input, { onWarning });

      expect(map.entities).toHaveLength(1);
      expect(onWarning).toHaveBeenCalledWith(expect.stringMatching(/First entity should be 'worldspawn'/), expect.any(Number));
    });

    it('should parse multiple entities', () => {
      const input = `{
"classname" "worldspawn"
}
{
"classname" "info_player_start"
"origin" "0 0 0"
}`;
      const map = MapParser.parse(input);
      expect(map.entities).toHaveLength(2);
      expect(map.entities[1].classname).toBe('info_player_start');
    });

    it('should parse entity with brushes', () => {
       const input = `{
"classname" "worldspawn"
{
( 0 0 0 ) ( 1 0 0 ) ( 0 1 0 ) texture 0 0 0 1 1
( 0 0 0 ) ( 0 1 0 ) ( 0 0 1 ) texture 0 0 0 1 1
( 0 0 0 ) ( 0 0 1 ) ( 1 0 0 ) texture 0 0 0 1 1
( 1 0 0 ) ( 0 1 0 ) ( 0 0 1 ) texture 0 0 0 1 1
}
}`;
       const map = MapParser.parse(input);
       expect(map.entities[0].brushes).toHaveLength(1);
       expect(map.entities[0].brushes[0].sides).toHaveLength(4);
    });
  });

  describe('validate', () => {
     it('should validate a correct map', () => {
       const input = `{
"classname" "worldspawn"
"mapversion" "220"
{
( 0 0 0 ) ( 1 0 0 ) ( 0 1 0 ) texture 0 0 0 1 1
( 0 0 0 ) ( 0 1 0 ) ( 0 0 1 ) texture 0 0 0 1 1
( 0 0 0 ) ( 0 0 1 ) ( 1 0 0 ) texture 0 0 0 1 1
( 1 0 0 ) ( 0 1 0 ) ( 0 0 1 ) texture 0 0 0 1 1
}
}`;
       const map = MapParser.parse(input);
       const result = MapParser.validate(map);
       expect(result.valid).toBe(true);
       expect(result.errors).toHaveLength(0);
     });

     it('should detect missing worldspawn', () => {
       // We force a map without worldspawn by non-strict parsing
       const input = `{
"classname" "func_wall"
}`;
       const map = MapParser.parse(input);
       const result = MapParser.validate(map);
       expect(result.valid).toBe(false);
       expect(result.errors).toContainEqual(expect.stringMatching(/First entity is 'func_wall'/));
     });

     it('should detect brush with few sides', () => {
        const input = `{
"classname" "worldspawn"
{
( 0 0 0 ) ( 1 0 0 ) ( 0 1 0 ) texture 0 0 0 1 1
}
}`;
        const map = MapParser.parse(input);
        const result = MapParser.validate(map);
        expect(result.valid).toBe(false);
        expect(result.errors).toContainEqual(expect.stringMatching(/minimum 4 required/));
     });

     it('should warn on version mismatch for Valve UVs', () => {
        const input = `{
"classname" "worldspawn"
"mapversion" "200"
{
( 0 0 0 ) ( 1 0 0 ) ( 0 1 0 ) texture [ 1 0 0 0 ] [ 0 1 0 0 ] 0 1 1
( 0 0 0 ) ( 0 1 0 ) ( 0 0 1 ) texture [ 1 0 0 0 ] [ 0 1 0 0 ] 0 1 1
( 0 0 0 ) ( 0 0 1 ) ( 1 0 0 ) texture [ 1 0 0 0 ] [ 0 1 0 0 ] 0 1 1
( 1 0 0 ) ( 0 1 0 ) ( 0 0 1 ) texture [ 1 0 0 0 ] [ 0 1 0 0 ] 0 1 1
}
}`;
        const map = MapParser.parse(input);
        // MapParser.parse sets mapVersion from property
        expect(map.mapVersion).toBe(200);

        const result = MapParser.validate(map);
        // Valid is true because this is a warning
        expect(result.valid).toBe(true);
        expect(result.warnings).toContainEqual(expect.stringMatching(/uses Valve 220 format but mapversion is 200/));
     });
  });
});
