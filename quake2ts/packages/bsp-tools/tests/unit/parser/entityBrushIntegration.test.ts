import { describe, it, expect } from 'vitest';
import { MapTokenizer } from '../../../src/parser/tokenizer.js';
import { parseEntity } from '../../../src/parser/entityParser.js';
// We do NOT mock brushParser here, so we test real integration

describe('Entity-Brush Integration', () => {
  it('should parse an entity with a real brush', () => {
    const input = `{
"classname" "worldspawn"
{
( 0 0 0 ) ( 1 0 0 ) ( 0 1 0 ) texture_name 0 0 0 1 1
( 0 0 0 ) ( 0 1 0 ) ( 0 0 1 ) texture_name 0 0 0 1 1
( 0 0 0 ) ( 0 0 1 ) ( 1 0 0 ) texture_name 0 0 0 1 1
( 1 0 0 ) ( 0 0 1 ) ( 0 1 0 ) texture_name 0 0 0 1 1
}
}`;
    const tokenizer = new MapTokenizer(input);
    const entity = parseEntity(tokenizer);

    expect(entity.classname).toBe('worldspawn');
    expect(entity.brushes).toHaveLength(1);
    const brush = entity.brushes[0];
    expect(brush.sides).toHaveLength(4);
    expect(brush.sides[0].texture).toBe('texture_name');
  });
});
