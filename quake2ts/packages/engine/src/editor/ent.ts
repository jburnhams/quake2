import { BspEntity } from '../assets/bsp.js';

export { BspEntity };

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Parse ENT file (entity lump text format) to entity objects
 */
export function parseEntLump(text: string): BspEntity[] {
    const entities: BspEntity[] = [];
    let currentProperties: Record<string, string> | null = null;
    let lines = text.split('\n');

    for (let line of lines) {
        line = line.trim();

        // Remove comments
        const commentIdx = line.indexOf('//');
        if (commentIdx !== -1) {
            line = line.substring(0, commentIdx).trim();
        }

        if (line.length === 0) continue;

        if (line === '{') {
            if (currentProperties) {
                // Nested brace or missing close brace? Push previous.
                entities.push({
                    classname: currentProperties['classname'],
                    properties: currentProperties
                });
            }
            currentProperties = {};
        } else if (line === '}') {
            if (currentProperties) {
                entities.push({
                    classname: currentProperties['classname'],
                    properties: currentProperties
                });
                currentProperties = null;
            }
        } else if (currentProperties) {
            // Parse "key" "value"
            const match = line.match(/"([^"]+)"\s+"([^"]*)"/);
            if (match) {
                const key = match[1];
                const value = match[2];
                currentProperties[key] = value;
            }
        }
    }

    // Catch trailing entity
    if (currentProperties) {
         entities.push({
            classname: currentProperties['classname'],
            properties: currentProperties
        });
    }

    return entities;
}

/**
 * Serialize entities to ENT file format
 */
export function serializeEntLump(entities: BspEntity[]): string {
    let output = '';

    for (const ent of entities) {
        output += '{\n';

        const classname = ent.classname || ent.properties['classname'];

        if (classname) {
            output += `"${'classname'}" "${classname}"\n`;
        }

        for (const [key, value] of Object.entries(ent.properties)) {
            if (key === 'classname') continue;
            output += `"${key}" "${value}"\n`;
        }

        output += '}\n';
    }

    return output;
}

/**
 * Validate entity properties
 */
export function validateEntity(entity: BspEntity): ValidationResult {
    const result: ValidationResult = {
        valid: true,
        errors: [],
        warnings: []
    };

    const classname = entity.classname || entity.properties['classname'];

    if (!classname || classname === 'unknown') {
        result.valid = false;
        result.errors.push('Missing or invalid classname');
    }

    // Example validations
    if (classname === 'worldspawn') {
        if (!entity.properties['message'] && !entity.properties['sky']) {
             result.warnings.push('worldspawn usually has a message or sky');
        }
    }

    // Check key format
    for (const key of Object.keys(entity.properties)) {
        if (key.includes(' ')) {
             result.warnings.push(`Key "${key}" contains spaces, which is discouraged`);
        }
    }

    return result;
}

export function serializeBspEntities(entities: BspEntity[]): string {
    return serializeEntLump(entities);
}
