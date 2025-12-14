export interface BspEntity {
  classname: string;
  [key: string]: string | number | undefined;
}

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
    let currentEntity: BspEntity | null = null;
    let lines = text.split('\n');
    let lineNum = 0;

    for (let line of lines) {
        lineNum++;
        line = line.trim();

        // Remove comments
        const commentIdx = line.indexOf('//');
        if (commentIdx !== -1) {
            line = line.substring(0, commentIdx).trim();
        }

        if (line.length === 0) continue;

        if (line === '{') {
            if (currentEntity) {
                // Nested brace or missing close brace?
                // Quake 2 format is flat list of {} blocks.
                // We'll assume previous entity ended implicitly or it's an error.
                // For robustness, push previous and start new.
                entities.push(currentEntity);
            }
            currentEntity = { classname: 'unknown' };
        } else if (line === '}') {
            if (currentEntity) {
                entities.push(currentEntity);
                currentEntity = null;
            }
        } else if (currentEntity) {
            // Parse "key" "value"
            // Handles quoted strings with spaces
            const match = line.match(/"([^"]+)"\s+"([^"]*)"/);
            if (match) {
                const key = match[1];
                const value = match[2];

                // Convert numeric values if possible?
                // Standard Quake 2 practice: everything is a string in the map file.
                // The game code parses it.
                // But the interface in enhancement request says "string | number | undefined".
                // If it looks like a number, should we parse it?
                // Usually map keys are strings.
                // "angle" "90" -> 90?
                // "origin" "10 20 30" -> string "10 20 30" (it's a vector)
                // "light" "200" -> 200

                // Let's keep it as string to preserve exact formatting for serialization,
                // OR parse strict numbers.
                // The prompt says BspEntity properties can be number.

                // Let's try to parse simple numbers, but keep vectors as strings.
                if (!isNaN(Number(value)) && value.trim() !== '') {
                     currentEntity[key] = Number(value);
                } else {
                     currentEntity[key] = value;
                }
            }
        }
    }

    // Catch trailing entity
    if (currentEntity) {
        entities.push(currentEntity);
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

        // Ensure classname is first (convention)
        if (ent.classname) {
            output += `"${'classname'}" "${ent.classname}"\n`;
        }

        for (const key in ent) {
            if (key === 'classname') continue;
            const value = ent[key];
            if (value !== undefined) {
                output += `"${key}" "${value}"\n`;
            }
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

    if (!entity.classname || entity.classname === 'unknown') {
        result.valid = false;
        result.errors.push('Missing or invalid classname');
    }

    // Example validations
    if (entity.classname === 'worldspawn') {
        if (!entity.message && !entity.sky) {
             result.warnings.push('worldspawn usually has a message or sky');
        }
    }

    // Check for target/targetname loops or broken references?
    // That requires global context.

    // Check key format
    for (const key in entity) {
        if (key.includes(' ')) {
             result.warnings.push(`Key "${key}" contains spaces, which is discouraged`);
        }
    }

    return result;
}
