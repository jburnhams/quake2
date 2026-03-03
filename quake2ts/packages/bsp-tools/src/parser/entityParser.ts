import { MapTokenizer, TokenType } from './tokenizer.js';
import { MapBrushDef, parseBrush } from './brushParser.js';

export interface MapEntityDef {
  classname: string;
  properties: Map<string, string>;
  brushes: MapBrushDef[];
  line: number;  // For error reporting
}

export interface EntityParseOptions {
  skipMalformed?: boolean;
  onWarning?: (message: string, line: number) => void;
}

export function parseKeyValue(tokenizer: MapTokenizer): { key: string; value: string } {
    // Keys and values are usually quoted strings, but we should be robust
    // and accept numbers as strings if they appear (though unlikely for keys).
    const keyToken = tokenizer.next();
    if (keyToken.type !== TokenType.STRING && keyToken.type !== TokenType.NUMBER) {
        throw new Error(`Expected string for key, got ${TokenType[keyToken.type]} ('${keyToken.value}') at line ${keyToken.line}, column ${keyToken.column}`);
    }

    const valueToken = tokenizer.next();
    if (valueToken.type !== TokenType.STRING && valueToken.type !== TokenType.NUMBER) {
        throw new Error(`Expected string for value, got ${TokenType[valueToken.type]} ('${valueToken.value}') at line ${valueToken.line}, column ${valueToken.column}`);
    }

    return { key: keyToken.value, value: valueToken.value };
}

export function parseEntity(tokenizer: MapTokenizer, options?: EntityParseOptions): MapEntityDef {
    const brace = tokenizer.expect(TokenType.OPEN_BRACE);
    const line = brace.line;
    const properties = new Map<string, string>();
    const brushes: MapBrushDef[] = [];
    let classname = '';

    while (!tokenizer.isAtEnd()) {
        const token = tokenizer.peek();

        if (token.type === TokenType.CLOSE_BRACE) {
            tokenizer.next(); // consume '}'
            break;
        }

        if (token.type === TokenType.OPEN_BRACE) {
            // Start of a brush
            tokenizer.next(); // Consume opening brace
            // We assume a default map version of 220 for now.
            // In a real scenario, mapVersion comes from worldspawn,
            // but we might be parsing worldspawn itself.
            // The brush parser handles version specifics.
            try {
                brushes.push(parseBrush(tokenizer, 220));
            } catch (err) {
                if (options?.skipMalformed) {
                    const message = err instanceof Error ? err.message : String(err);
                    options.onWarning?.(`Skipping malformed brush at line ${token.line}: ${message}`, token.line);
                    // Recover: consume until '}' matching the brush start
                    // Since we already consumed the opening '{' for the brush,
                    // we just need to scan until we find the closing '}'.
                    // Note: This simple recovery assumes brushes don't contain nested blocks,
                    // which is true for standard Quake map format.
                    while (!tokenizer.isAtEnd()) {
                        const t = tokenizer.next();
                        if (t.type === TokenType.CLOSE_BRACE) {
                            break;
                        }
                    }
                } else {
                    throw err;
                }
            }
        } else if (token.type === TokenType.STRING || token.type === TokenType.NUMBER) {
            // Property
            const kv = parseKeyValue(tokenizer);
            properties.set(kv.key, kv.value);
            if (kv.key === 'classname') {
                classname = kv.value;
            }
        } else if (token.type === TokenType.OPEN_PAREN) {
            // Sometimes map editors output brushes without surrounding braces
            // directly inside the entity block. This is technically non-standard
            // Q2 map format (which expects nested braces for brushes), but some tools do it.
            // We can try to parse a brush here.
            try {
                brushes.push(parseBrush(tokenizer, 220));
            } catch (err) {
                if (options?.skipMalformed) {
                    const message = err instanceof Error ? err.message : String(err);
                    options.onWarning?.(`Skipping malformed brush at line ${token.line}: ${message}`, token.line);
                    // Recover: consume until '}' or another brush start
                    while (!tokenizer.isAtEnd()) {
                        const t = tokenizer.peek();
                        if (t.type === TokenType.CLOSE_BRACE || t.type === TokenType.OPEN_PAREN) {
                            break;
                        }
                        tokenizer.next();
                    }
                } else {
                    throw err;
                }
            }
        } else {
             throw new Error(`Unexpected token inside entity: ${TokenType[token.type]} ('${token.value}') at line ${token.line}, column ${token.column}`);
        }
    }

    return {
        classname,
        properties,
        brushes,
        line
    };
}
