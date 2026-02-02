import { MapTokenizer, TokenType } from './tokenizer.js';
import { MapBrushDef, parseBrush } from './brushParser.js';

export interface MapEntityDef {
  classname: string;
  properties: Map<string, string>;
  brushes: MapBrushDef[];
  line: number;  // For error reporting
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

export function parseEntity(tokenizer: MapTokenizer): MapEntityDef {
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
            brushes.push(parseBrush(tokenizer, 220));
        } else if (token.type === TokenType.STRING || token.type === TokenType.NUMBER) {
            // Property
            const kv = parseKeyValue(tokenizer);
            properties.set(kv.key, kv.value);
            if (kv.key === 'classname') {
                classname = kv.value;
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
