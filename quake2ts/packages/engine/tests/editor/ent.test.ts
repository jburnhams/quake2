import { describe, it, expect } from 'vitest';
import { parseEntLump, serializeEntLump, validateEntity, BspEntity } from '../../src/editor/ent.js';

const SAMPLE_ENT_DATA = `
{
"classname" "worldspawn"
"message" "Welcome to Quake"
"worldtype" "0"
}
{
"classname" "info_player_start"
"origin" "64 64 24"
"angle" "90"
}
{
"classname" "light"
"origin" "128 128 64"
"light" "300"
"_color" "1 0 0"
}
`;

describe('ENT Parser', () => {
    it('should parse a standard ENT string', () => {
        const entities = parseEntLump(SAMPLE_ENT_DATA);
        expect(entities).toHaveLength(3);

        expect(entities[0].classname).toBe('worldspawn');
        expect(entities[0].message).toBe('Welcome to Quake');
        expect(entities[0].worldtype).toBe(0); // Parsed as number

        expect(entities[1].classname).toBe('info_player_start');
        expect(entities[1].origin).toBe('64 64 24'); // Vector string
        expect(entities[1].angle).toBe(90);

        expect(entities[2].classname).toBe('light');
        expect(entities[2].light).toBe(300);
        expect(entities[2]['_color']).toBe('1 0 0');
    });

    it('should handle comments', () => {
        const data = `
{
"classname" "func_door" // This is a door
"angle" "90"
// "broken" "field"
}
`;
        const entities = parseEntLump(data);
        expect(entities).toHaveLength(1);
        expect(entities[0].classname).toBe('func_door');
        expect(entities[0].angle).toBe(90);
        expect(entities[0].broken).toBeUndefined();
    });
});

describe('ENT Serializer', () => {
    it('should serialize entities back to string format', () => {
        const entities: BspEntity[] = [
            { classname: 'info_null', origin: '0 0 0' },
            { classname: 'light', light: 200 }
        ];

        const output = serializeEntLump(entities);

        expect(output).toContain('"classname" "info_null"');
        expect(output).toContain('"origin" "0 0 0"');
        expect(output).toContain('"classname" "light"');
        expect(output).toContain('"light" "200"');

        // Should parse back identically
        const reparsed = parseEntLump(output);
        expect(reparsed).toEqual(entities);
    });
});

describe('Entity Validation', () => {
    it('should fail on missing classname', () => {
        const ent = { foo: 'bar' } as any;
        const result = validateEntity(ent);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Missing or invalid classname');
    });

    it('should pass on valid entity', () => {
        const ent = { classname: 'info_player_start', origin: '0 0 0' };
        const result = validateEntity(ent);
        expect(result.valid).toBe(true);
    });

    it('should warn on worldspawn without message or sky', () => {
        const ent = { classname: 'worldspawn' };
        const result = validateEntity(ent);
        expect(result.valid).toBe(true);
        expect(result.warnings.length).toBeGreaterThan(0);
    });
});
