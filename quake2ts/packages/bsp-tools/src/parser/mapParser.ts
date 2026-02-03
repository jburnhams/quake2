import { MapTokenizer, TokenType } from './tokenizer.js';
import { parseEntity, MapEntityDef } from './entityParser.js';
import { MapParseError } from './errors.js';

export interface ParsedMap {
  entities: MapEntityDef[];
  worldspawn: MapEntityDef;
  mapVersion: number;
}

export interface ParseOptions {
  /** Strict mode fails on warnings, lenient mode continues */
  strict?: boolean;

  /** Callback for warnings */
  onWarning?: (message: string, line: number) => void;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export class MapParser {
  /**
   * Parse a .map file from string content
   */
  static parse(content: string, options: ParseOptions = {}): ParsedMap {
    const tokenizer = new MapTokenizer(content);
    const entities: MapEntityDef[] = [];

    try {
      while (!tokenizer.isAtEnd()) {
        const token = tokenizer.peek();

        if (token.type === TokenType.EOF) {
          break;
        }

        // Entities start with '{'
        if (token.type === TokenType.OPEN_BRACE) {
          try {
            const entity = parseEntity(tokenizer);
            entities.push(entity);
          } catch (err: unknown) {
            // Enrich error with location if missing
            if (!(err instanceof MapParseError)) {
              throw new MapParseError(
                err.message,
                tokenizer.line,
                tokenizer.column
              );
            }
            throw err;
          }
        } else {
          throw new MapParseError(
            `Expected start of entity ('{'), got ${TokenType[token.type]} ('${token.value}')`,
            token.line,
            token.column
          );
        }
      }
    } catch (err: any) {
      if (err instanceof MapParseError) {
        throw err;
      }
      throw new MapParseError(err.message, tokenizer.line, tokenizer.column);
    }

    if (entities.length === 0) {
      // Is an empty file valid? Probably not useful.
      // But maybe technically valid if it's just whitespace?
      // No, a valid map must have at least worldspawn.
      if (options.strict) {
         throw new MapParseError("Map contains no entities", 1, 1);
      }
      // If not strict, we return what we have, but we can't really return a valid ParsedMap structure without worldspawn.
      // We will throw anyway because we need worldspawn.
      throw new MapParseError("Map contains no entities", 1, 1);
    }

    // Worldspawn is assumed to be the first entity
    const worldspawn = entities[0];

    // Check if first entity is worldspawn
    if (worldspawn.classname !== 'worldspawn') {
      const msg = `First entity should be 'worldspawn', found '${worldspawn.classname}'`;
      if (options.strict) {
        throw new MapParseError(msg, worldspawn.line, 0);
      }
      options.onWarning?.(msg, worldspawn.line);
    }

    // Extract map version
    let mapVersion = 220; // Default if not specified
    if (worldspawn.properties.has('mapversion')) {
      const verStr = worldspawn.properties.get('mapversion');
      const ver = parseInt(verStr!, 10);
      if (!isNaN(ver)) {
        mapVersion = ver;
      }
    }

    return {
      entities,
      worldspawn,
      mapVersion
    };
  }

  /**
   * Validate a parsed map for common issues
   */
  static validate(map: ParsedMap): ValidationResult {
    const result: ValidationResult = { valid: true, errors: [], warnings: [] };

    // 1. Check worldspawn
    if (map.entities.length === 0) {
      result.valid = false;
      result.errors.push("Map has no entities");
      return result;
    }

    if (map.entities[0].classname !== 'worldspawn') {
      result.valid = false;
      result.errors.push(`First entity is '${map.entities[0].classname}', expected 'worldspawn'`);
    }

    // 2. Check brushes
    for (const entity of map.entities) {
      for (const brush of entity.brushes) {
        // Brushes must have at least 4 sides to form a closed volume
        if (brush.sides.length < 4) {
          result.valid = false;
          result.errors.push(`Brush at line ${brush.line} has ${brush.sides.length} sides (minimum 4 required)`);
        }

        // Check for Valve 220 format consistency
        for (const side of brush.sides) {
           if (side.uAxis || side.vAxis) {
               // It has Valve UVs
               if (map.mapVersion < 220) {
                   result.warnings.push(`Brush side at line ${side.line} uses Valve 220 format but mapversion is ${map.mapVersion} (< 220)`);
               }
           }
        }
      }
    }

    return result;
  }
}
