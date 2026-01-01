import { describe, it, expect } from 'vitest';
import { parseEntLump, serializeEntLump, validateEntity, EntEntity } from '../../../src/assets/ent.js';

describe('ENT Parser', () => {
  it('parses a simple entity', () => {
    const input = `
{
"classname" "info_player_start"
"origin" "0 0 0"
}
`;
    const result = parseEntLump(input);
    expect(result).toHaveLength(1);
    expect(result[0].classname).toBe('info_player_start');
    expect(result[0].properties['origin']).toBe('0 0 0');
  });

  it('parses multiple entities', () => {
    const input = `
{
"classname" "worldspawn"
"message" "Test Map"
}
{
"classname" "info_player_start"
"origin" "100 0 0"
}
`;
    const result = parseEntLump(input);
    expect(result).toHaveLength(2);
    expect(result[0].classname).toBe('worldspawn');
    expect(result[1].classname).toBe('info_player_start');
  });

  it('handles comments if implemented (skips them or parses around them)', () => {
    const input = `
// This is a comment
{
"classname" "func_door" // Inline comment
"angle" "90"
}
`;
    const result = parseEntLump(input);
    expect(result).toHaveLength(1);
    expect(result[0].classname).toBe('func_door');
    expect(result[0].properties['angle']).toBe('90');
  });

  it('handles weird whitespace', () => {
    const input = `
      {  "classname"    "misc_teleporter"
 "target"
 "dest1" }
`;
    const result = parseEntLump(input);
    expect(result).toHaveLength(1);
    expect(result[0].classname).toBe('misc_teleporter');
    expect(result[0].properties['target']).toBe('dest1');
  });

  it('handles unquoted keys (robustness)', () => {
      // The parser implementation tries to be robust
      const input = `{ classname info_player_start }`;
      const result = parseEntLump(input);
      // Depending on implementation, this might work or fail.
      // Our implementation currently expects quotes for keys/values if it follows strictly,
      // but the `readToken` handles unquoted tokens too.
      expect(result).toHaveLength(1);
      expect(result[0].properties['classname']).toBe('info_player_start');
  });
});

describe('ENT Serializer', () => {
  it('serializes entities correctly', () => {
    const entities: EntEntity[] = [
      {
        classname: 'worldspawn',
        properties: {
          classname: 'worldspawn',
          message: 'Hello World'
        }
      },
      {
        classname: 'light',
        properties: {
          classname: 'light',
          light: '300',
          origin: '10 10 10'
        }
      }
    ];

    const output = serializeEntLump(entities);
    expect(output).toContain('"classname" "worldspawn"');
    expect(output).toContain('"message" "Hello World"');
    expect(output).toContain('"light" "300"');
    // Check structure
    expect(output.match(/\{/g)).toHaveLength(2);
    expect(output.match(/\}/g)).toHaveLength(2);
  });

  it('round trips', () => {
    const entities: EntEntity[] = [
      {
        classname: 'func_wall',
        properties: {
          classname: 'func_wall',
          model: '*1',
          origin: '64 64 64'
        }
      }
    ];

    const serialized = serializeEntLump(entities);
    const parsed = parseEntLump(serialized);

    expect(parsed).toEqual(entities);
  });
});

describe('Entity Validation', () => {
  it('validates correct entity', () => {
    const ent: EntEntity = {
      classname: 'info_null',
      properties: {
        classname: 'info_null',
        origin: '0 0 0'
      }
    };
    const result = validateEntity(ent);
    expect(result.valid).toBe(true);
  });

  it('detects missing classname', () => {
    const ent: EntEntity = {
      classname: undefined,
      properties: {
        origin: '0 0 0'
      }
    };
    const result = validateEntity(ent);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Missing "classname" property');
  });

  it('detects invalid origin', () => {
    const ent: EntEntity = {
      classname: 'test',
      properties: {
        classname: 'test',
        origin: '0 0' // only 2 components
      }
    };
    const result = validateEntity(ent);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('Invalid origin format');
  });
});
