import { describe, it, expect } from 'vitest';
import { serializeBspEntities, parseEntLump } from '../../../src/editor/ent.js';
import { BspEntity } from '../../../src/assets/bsp.js';

describe('Entity Serialization', () => {
    it('should serialize a single entity', () => {
        const input: BspEntity[] = [
            {
                classname: 'info_player_start',
                properties: {
                    origin: '0 0 0',
                    angle: '90',
                    classname: 'info_player_start'
                }
            }
        ];

        const expected = `{\n"classname" "info_player_start"\n"origin" "0 0 0"\n"angle" "90"\n}\n`;
        const result = serializeBspEntities(input);
        expect(result).toBe(expected);
    });

    it('should serialize multiple entities', () => {
         const input: BspEntity[] = [
            {
                classname: 'worldspawn',
                properties: {
                    classname: 'worldspawn',
                    message: 'My Map'
                }
            },
            {
                classname: 'light',
                properties: {
                    classname: 'light',
                    origin: '100 100 100',
                    light: '300'
                }
            }
        ];

        const expected = `{\n"classname" "worldspawn"\n"message" "My Map"\n}\n{\n"classname" "light"\n"origin" "100 100 100"\n"light" "300"\n}\n`;
        const result = serializeBspEntities(input);
        expect(result).toBe(expected);
    });

    it('should handle missing classname property (if properties object implies it)', () => {
        const input: BspEntity[] = [
            {
                // @ts-ignore
                classname: undefined,
                properties: {
                    classname: 'func_door',
                    angle: '-1',
                    speed: '100'
                }
            }
        ];
         const expected = `{\n"classname" "func_door"\n"angle" "-1"\n"speed" "100"\n}\n`;
         const result = serializeBspEntities(input);
         expect(result).toBe(expected);
    });
});

describe('Entity Parsing', () => {
    it('should parse entities', () => {
        const input = `
{
"classname" "info_player_start"
"origin" "0 0 0"
}
{
"classname" "light"
"light" "300"
}
`;
        const result = parseEntLump(input);
        expect(result).toHaveLength(2);
        expect(result[0].classname).toBe('info_player_start');
        expect(result[0].properties['origin']).toBe('0 0 0');
        expect(result[1].classname).toBe('light');
        expect(result[1].properties['light']).toBe('300');
    });

    it('should strip comments', () => {
        const input = `
{
"classname" "info_player_start"
// "origin" "0 0 0"
"angle" "90" // This is a comment
}
`;
        const result = parseEntLump(input);
        expect(result).toHaveLength(1);
        expect(result[0].classname).toBe('info_player_start');
        expect(result[0].properties['origin']).toBeUndefined();
        expect(result[0].properties['angle']).toBe('90');
    });
});
