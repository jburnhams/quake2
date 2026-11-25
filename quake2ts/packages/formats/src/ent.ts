// ENT file parser/serializer for Quake II
// Handles parsing of entity lumps in text format (ENT) and serialization back to text.

export interface EntEntity {
  classname?: string;
  properties: Record<string, string>;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Parses an ENT entity lump string into an array of entity objects.
 *
 * @param text The ENT file content (string).
 * @returns Array of parsed entities with properties.
 */
export function parseEntLump(text: string): EntEntity[] {
  const entities: EntEntity[] = [];

  // Clean up comments first: // comments (C style) aren't standard in Q2 ent files but sometimes used in map editors
  // Standard Q2 ent files use "{" and "}" to delimit entities and "key" "value" pairs.
  // We'll stick to the standard Q2 format which is loose about whitespace.

  let cursor = 0;
  const length = text.length;

  // Helper to skip whitespace
  function skipWhitespace() {
    while (cursor < length && /\s/.test(text[cursor])) {
      cursor++;
    }
  }

  // Helper to read a token (quoted string or identifier)
  // Quake 2 parser basically looks for quotes. If no quotes, it might read until whitespace?
  // Actually, standard Q2 parser expects keys and values to be quoted.
  // But let's be robust.
  function readToken(): string | null {
    skipWhitespace();
    if (cursor >= length) return null;

    if (text[cursor] === '"') {
      cursor++; // skip opening quote
      const start = cursor;
      while (cursor < length && text[cursor] !== '"') {
        // Handle escaped quotes? Quake 2 doesn't really support them standardly but let's see.
        // Q2 source Cmd_TokenizeString handles quotes but doesn't seem to support escapes inside them easily,
        // it just ends at the next quote.
        if (text[cursor] === '\n') {
           // Newlines inside quotes are generally not allowed or break things, but we'll allow them.
        }
        cursor++;
      }
      const token = text.substring(start, cursor);
      cursor++; // skip closing quote
      return token;
    } else if (text[cursor] === '{' || text[cursor] === '}') {
      // Structural tokens
      return text[cursor++];
    } else {
      // Unquoted token? comments?
      // Some editors support // comments.
      if (text.startsWith('//', cursor)) {
        while (cursor < length && text[cursor] !== '\n') {
          cursor++;
        }
        return readToken(); // try again after comment
      }

      // Read until whitespace
      const start = cursor;
      while (cursor < length && !/\s/.test(text[cursor]) && text[cursor] !== '}' && text[cursor] !== '{') {
        cursor++;
      }
      return text.substring(start, cursor);
    }
  }

  while (cursor < length) {
    const token = readToken();
    if (token === null) break;

    if (token === '{') {
      const properties: Record<string, string> = {};

      while (true) {
        // Peek or read next token
        // We expect a key (string) or '}'

        // We need to implement a peek or just read and handle.
        const originalCursor = cursor;
        const key = readToken();

        if (key === '}') {
          break;
        }

        if (key === null) {
          // Unexpected end of file inside entity
          break;
        }

        if (key === '{') {
          // Nested braces are not allowed, but maybe we should recover?
          // Treat as start of new entity? Error?
          // Q2 parser would probably get confused.
          // We will treat it as a syntax error effectively but let's just continue
          // assuming the previous entity ended.
          cursor = originalCursor; // backtrack to let the outer loop handle '{'
          break;
        }

        // Expect value
        const value = readToken();
        if (value === null || value === '}' || value === '{') {
          // Missing value
          if (value === '}') cursor--; // push back
          if (value === '{') cursor--; // push back
          // properties[key] = ""; // valid?
          break;
        }

        properties[key] = value;
      }

      entities.push({
        classname: properties['classname'],
        properties
      });
    }
  }

  return entities;
}

/**
 * Serializes an array of entities to the ENT file format.
 *
 * @param entities Array of entities to serialize.
 * @returns The ENT string.
 */
export function serializeEntLump(entities: EntEntity[]): string {
  let output = '';

  for (const entity of entities) {
    output += '{\n';

    // Ensure classname is first for readability, though not strictly required
    const keys = Object.keys(entity.properties);
    const sortedKeys = keys.sort((a, b) => {
      if (a === 'classname') return -1;
      if (b === 'classname') return 1;
      if (a === 'origin') return -1;
      if (b === 'origin') return 1;
      return a.localeCompare(b);
    });

    for (const key of sortedKeys) {
      const value = entity.properties[key];
      // Escape quotes in value? Q2 doesn't support them well, but let's just escape backslashes and quotes if we were to support it.
      // Standard Q2 maps don't use escapes. We will just dump it.
      // If keys/values contain quotes, it will break.
      output += `"${key}" "${value}"\n`;
    }

    output += '}\n';
  }

  return output;
}

/**
 * Validates an entity against basic rules.
 *
 * @param entity The entity to validate.
 * @returns validation result
 */
export function validateEntity(entity: EntEntity): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!entity.properties['classname']) {
    errors.push('Missing "classname" property');
  }

  // Check origin format if present
  if (entity.properties['origin']) {
    const parts = entity.properties['origin'].split(' ');
    if (parts.length !== 3 || parts.some(p => isNaN(parseFloat(p)))) {
      errors.push(`Invalid origin format: "${entity.properties['origin']}"`);
    }
  }

  // Check angle format if present
  if (entity.properties['angle']) {
    if (isNaN(parseFloat(entity.properties['angle']))) {
      errors.push(`Invalid angle format: "${entity.properties['angle']}"`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}
