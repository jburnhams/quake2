export class MapParseError extends Error {
  constructor(
    message: string,
    public readonly line: number,
    public readonly column: number,
    public readonly source?: string
  ) {
    super(`Line ${line}, column ${column}: ${message}`);
    this.name = 'MapParseError';
    // Ensure prototype chain is correct for instanceof checks
    Object.setPrototypeOf(this, MapParseError.prototype);
  }
}
