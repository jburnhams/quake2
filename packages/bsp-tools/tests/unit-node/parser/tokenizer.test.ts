import { describe, it, expect } from 'vitest';
import { MapTokenizer, TokenType } from '../../../src/parser/tokenizer';

describe('MapTokenizer', () => {
  it('should handle empty input', () => {
    const tokenizer = new MapTokenizer('');
    const token = tokenizer.next();
    expect(token.type).toBe(TokenType.EOF);
  });

  it('should handle single tokens', () => {
    const tokenizer = new MapTokenizer('{}()[]');
    expect(tokenizer.next().type).toBe(TokenType.OPEN_BRACE);
    expect(tokenizer.next().type).toBe(TokenType.CLOSE_BRACE);
    expect(tokenizer.next().type).toBe(TokenType.OPEN_PAREN);
    expect(tokenizer.next().type).toBe(TokenType.CLOSE_PAREN);
    expect(tokenizer.next().type).toBe(TokenType.OPEN_BRACKET);
    expect(tokenizer.next().type).toBe(TokenType.CLOSE_BRACKET);
    expect(tokenizer.next().type).toBe(TokenType.EOF);
  });

  it('should handle strings', () => {
    const tokenizer = new MapTokenizer('"quoted string" unquoted_string');

    const token1 = tokenizer.next();
    expect(token1.type).toBe(TokenType.STRING);
    expect(token1.value).toBe('quoted string');

    const token2 = tokenizer.next();
    expect(token2.type).toBe(TokenType.STRING);
    expect(token2.value).toBe('unquoted_string');
  });

  it('should handle numbers', () => {
    const tokenizer = new MapTokenizer('123 -456 12.34 -56.78');

    expect(tokenizer.next().value).toBe('123');
    expect(tokenizer.next().value).toBe('-456');
    expect(tokenizer.next().value).toBe('12.34');
    expect(tokenizer.next().value).toBe('-56.78');
  });

  it('should distinguish numbers from strings starting with digits', () => {
      // "3_tex" is a string, "123" is a number
      const tokenizer = new MapTokenizer('123 3_tex 0.5 0_tex');

      const t1 = tokenizer.next();
      expect(t1.type).toBe(TokenType.NUMBER);
      expect(t1.value).toBe('123');

      const t2 = tokenizer.next();
      expect(t2.type).toBe(TokenType.STRING);
      expect(t2.value).toBe('3_tex');

      const t3 = tokenizer.next();
      expect(t3.type).toBe(TokenType.NUMBER);
      expect(t3.value).toBe('0.5');

      const t4 = tokenizer.next();
      expect(t4.type).toBe(TokenType.STRING);
      expect(t4.value).toBe('0_tex');
  });

  it('should skip whitespace', () => {
    const tokenizer = new MapTokenizer('  \t\n  {  }  ');
    expect(tokenizer.next().type).toBe(TokenType.OPEN_BRACE);
    expect(tokenizer.next().type).toBe(TokenType.CLOSE_BRACE);
    expect(tokenizer.next().type).toBe(TokenType.EOF);
  });

  it('should skip comments', () => {
    const tokenizer = new MapTokenizer('// comment\n{ // comment 2\n }');
    expect(tokenizer.next().type).toBe(TokenType.OPEN_BRACE);
    expect(tokenizer.next().type).toBe(TokenType.CLOSE_BRACE);
    expect(tokenizer.next().type).toBe(TokenType.EOF);
  });

  it('should track line and column', () => {
    const tokenizer = new MapTokenizer('{\n  "key"\n}');

    const t1 = tokenizer.next();
    expect(t1.type).toBe(TokenType.OPEN_BRACE);
    expect(t1.line).toBe(1);

    const t2 = tokenizer.next();
    expect(t2.type).toBe(TokenType.STRING);
    expect(t2.value).toBe('key');
    expect(t2.line).toBe(2);

    const t3 = tokenizer.next();
    expect(t3.type).toBe(TokenType.CLOSE_BRACE);
    expect(t3.line).toBe(3);
  });

  it('should peek without consuming', () => {
      const tokenizer = new MapTokenizer('{ }');

      expect(tokenizer.peek().type).toBe(TokenType.OPEN_BRACE);
      expect(tokenizer.peek().type).toBe(TokenType.OPEN_BRACE); // Should be same

      expect(tokenizer.next().type).toBe(TokenType.OPEN_BRACE);
      expect(tokenizer.next().type).toBe(TokenType.CLOSE_BRACE);
  });

  it('should handle multiple peeks and next calls', () => {
      const tokenizer = new MapTokenizer('A B');

      expect(tokenizer.peek().value).toBe('A');
      expect(tokenizer.next().value).toBe('A');

      expect(tokenizer.peek().value).toBe('B');
      expect(tokenizer.next().value).toBe('B');

      expect(tokenizer.peek().type).toBe(TokenType.EOF);
      expect(tokenizer.next().type).toBe(TokenType.EOF);
  });

  it('should expect specific tokens', () => {
      const tokenizer = new MapTokenizer('{');
      expect(tokenizer.expect(TokenType.OPEN_BRACE).type).toBe(TokenType.OPEN_BRACE);
  });

  it('should throw on unexpected token type', () => {
      const tokenizer = new MapTokenizer('}');
      expect(() => tokenizer.expect(TokenType.OPEN_BRACE)).toThrow(/Expected token type OPEN_BRACE/);
  });

  it('should expect specific values', () => {
      const tokenizer = new MapTokenizer('test');
      expect(() => tokenizer.expectValue('test')).not.toThrow();
  });

  it('should throw on unexpected value', () => {
      const tokenizer = new MapTokenizer('foo');
      expect(() => tokenizer.expectValue('bar')).toThrow(/Expected 'bar'/);
  });
});
