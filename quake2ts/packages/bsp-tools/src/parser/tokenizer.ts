export enum TokenType {
  STRING,       // "quoted string" or unquoted_word
  NUMBER,       // 123 or -45.67
  OPEN_BRACE,   // {
  CLOSE_BRACE,  // }
  OPEN_PAREN,   // (
  CLOSE_PAREN,  // )
  OPEN_BRACKET, // [
  CLOSE_BRACKET,// ]
  EOF,
}

export interface Token {
  type: TokenType;
  value: string;
  line: number;
  column: number;
}

export class MapTokenizer {
  private source: string;
  private current: number = 0;
  private _line: number = 1;
  private _column: number = 1;
  private peekedToken: Token | null = null;
  private peekedState: { current: number; line: number; column: number } | null = null;

  constructor(source: string) {
    this.source = source;
  }

  get line(): number {
    return this._line;
  }

  get column(): number {
    return this._column;
  }

  /**
   * Returns the next token without advancing the parser state.
   */
  peek(): Token {
    if (this.peekedToken) {
      return this.peekedToken;
    }

    const startPos = this.current;
    const startLine = this._line;
    const startCol = this._column;

    this.peekedToken = this.readToken();

    // Save the state after reading
    this.peekedState = {
      current: this.current,
      line: this._line,
      column: this._column
    };

    // Reset state to before reading
    this.current = startPos;
    this._line = startLine;
    this._column = startCol;

    return this.peekedToken;
  }

  /**
   * Returns the next token and advances the parser state.
   */
  next(): Token {
    if (this.peekedToken && this.peekedState) {
      const token = this.peekedToken;

      // Advance state to where peek left off
      this.current = this.peekedState.current;
      this._line = this.peekedState.line;
      this._column = this.peekedState.column;

      this.peekedToken = null;
      this.peekedState = null;
      return token;
    }
    return this.readToken();
  }

  expect(type: TokenType): Token {
    const token = this.next();
    if (token.type !== type) {
      throw new Error(`Expected token type ${TokenType[type]}, but got ${TokenType[token.type]} ('${token.value}') at line ${token.line}, column ${token.column}`);
    }
    return token;
  }

  expectValue(value: string): void {
    const token = this.next();
    if (token.value !== value) {
      throw new Error(`Expected '${value}', but got '${token.value}' at line ${token.line}, column ${token.column}`);
    }
  }

  isAtEnd(): boolean {
    return this.peek().type === TokenType.EOF;
  }

  private advance(): string {
    if (this.current >= this.source.length) return '\0';
    const c = this.source[this.current++];
    if (c === '\n') {
      this._line++;
      this._column = 1;
    } else {
      this._column++;
    }
    return c;
  }

  private peekChar(): string {
    if (this.current >= this.source.length) return '\0';
    return this.source[this.current];
  }

  private match(expected: string): boolean {
    if (this.peekChar() === expected) {
      this.advance();
      return true;
    }
    return false;
  }

  private skipWhitespaceAndComments(): void {
    while (true) {
      const c = this.peekChar();
      if (c === ' ' || c === '\t' || c === '\r' || c === '\n') {
        this.advance();
      } else if (c === '/' && this.source[this.current + 1] === '/') {
        // Comment
        while (this.peekChar() !== '\n' && this.peekChar() !== '\0') {
          this.advance();
        }
      } else {
        break;
      }
    }
  }

  private readToken(): Token {
    this.skipWhitespaceAndComments();

    const startLine = this._line;
    const startColumn = this._column;

    if (this.current >= this.source.length) {
      return { type: TokenType.EOF, value: '', line: startLine, column: startColumn };
    }

    const c = this.advance();

    if (c === '{') return { type: TokenType.OPEN_BRACE, value: '{', line: startLine, column: startColumn };
    if (c === '}') return { type: TokenType.CLOSE_BRACE, value: '}', line: startLine, column: startColumn };
    if (c === '(') return { type: TokenType.OPEN_PAREN, value: '(', line: startLine, column: startColumn };
    if (c === ')') return { type: TokenType.CLOSE_PAREN, value: ')', line: startLine, column: startColumn };
    if (c === '[') return { type: TokenType.OPEN_BRACKET, value: '[', line: startLine, column: startColumn };
    if (c === ']') return { type: TokenType.CLOSE_BRACKET, value: ']', line: startLine, column: startColumn };

    // String
    if (c === '"') {
      let value = '';
      while (this.peekChar() !== '"' && this.peekChar() !== '\0') {
        value += this.advance();
      }
      if (this.peekChar() === '"') {
        this.advance();
      } else {
        throw new Error(`Unterminated string at line ${startLine}, column ${startColumn}`);
      }
      return { type: TokenType.STRING, value, line: startLine, column: startColumn };
    }

    // Number or Unquoted String
    // We start with what we have.
    // If it starts with digit or '-' or '.', it MIGHT be a number.
    // But in .map files, texture names can be "3_tex".
    // However, usually geometry definitions are strictly numbers.
    // Let's check the spec or q2tools.
    // q2tools `GetToken` treats everything as string unless `crossline` check.
    // But `docs/section-25-3.md` specifies `TokenType.NUMBER`.
    // I'll try to parse as number if it LOOKS like a number.

    // Check for number start
    if (this.isDigit(c) || c === '-' || c === '.') {
        // Read until non-number char
        let value = c;
        let isNumber = true;

        // Peek ahead
        while(true) {
            const p = this.peekChar();
            if (this.isDigit(p) || p === '.') {
                value += this.advance();
            } else if (this.isAlpha(p) || p === '_' || p === '/' || p === '*' || p === '+') {
                 // It contains letters or other chars -> likely a texture name starting with digit
                 // e.g. "0_test"
                 isNumber = false;
                 // consume the rest of the word
                 value += this.advance();
                 while (!this.isWhitespace(this.peekChar()) && !this.isPunctuation(this.peekChar()) && this.peekChar() !== '\0') {
                    value += this.advance();
                 }
                 break;
            } else {
                break;
            }
        }

        if (isNumber) {
             // Validate if it is a valid number structure (e.g. not "1.2.3" or "-")
             if (value === '-' || value === '.') isNumber = false;
             if (value.split('.').length > 2) isNumber = false;
        }

        return {
            type: isNumber ? TokenType.NUMBER : TokenType.STRING,
            value,
            line: startLine,
            column: startColumn
        };
    }

    // Unquoted string (identifier, texture name, etc)
    let value = c;
    while (!this.isWhitespace(this.peekChar()) && !this.isPunctuation(this.peekChar()) && this.peekChar() !== '\0') {
      value += this.advance();
    }
    return { type: TokenType.STRING, value, line: startLine, column: startColumn };
  }

  private isDigit(c: string): boolean {
    return c >= '0' && c <= '9';
  }

  private isAlpha(c: string): boolean {
      return (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z');
  }

  private isWhitespace(c: string): boolean {
    return c === ' ' || c === '\t' || c === '\r' || c === '\n';
  }

  private isPunctuation(c: string): boolean {
    return c === '{' || c === '}' || c === '(' || c === ')' || c === '[' || c === ']';
  }
}
