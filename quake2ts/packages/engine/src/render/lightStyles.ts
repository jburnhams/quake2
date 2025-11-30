export class LightStyleManager {
  private readonly styles = new Map<number, string>();
  private readonly values = new Float32Array(256); // Max 256 styles

  constructor() {
    this.setDefaultStyles();
  }

  private setDefaultStyles(): void {
    // Standard Quake 2 light styles
    this.styles.set(0, 'm');
    this.styles.set(1, 'mmnmmommommnonmmonqnmmo');
    this.styles.set(2, 'abcdefghijklmnopqrstuvwxyzyxwvutsrqponmlkjihgfedcba');
    this.styles.set(3, 'mmmmmaaaaammmmmaaaaaabcdefgabcdefg');
    this.styles.set(4, 'mamamamamama');
    this.styles.set(5, 'jklmnopqrstuvwxyzyxwvutsrqponmlkj');
    this.styles.set(6, 'nmonqnmomnmomomno');
    this.styles.set(7, 'mmmaaaabcdefgmmmmaaaammmaamm');
    this.styles.set(8, 'mmmaaammmaaammmabcdefaaaammmmabcdefmmmaaaa');
    this.styles.set(9, 'aaaaaaaazzzzzzzz');
    this.styles.set(10, 'mmamammmmammamamaaamammma');
    this.styles.set(11, 'abcdefghijklmnopqrrqponmlkjihgfedcba');
  }

  setStyle(index: number, pattern: string): void {
    this.styles.set(index, pattern);
  }

  update(timeSeconds: number): void {
    // Light styles animate at 10Hz (0.1s per frame)
    const frame = Math.floor(timeSeconds * 10);

    for (const [index, pattern] of this.styles) {
      if (pattern.length === 0) {
        this.values[index] = 1;
        continue;
      }

      const charIndex = frame % pattern.length;
      const charCode = pattern.charCodeAt(charIndex);
      // 'a' is 0, 'z' is 25. 'm' is 12 (approx middle).
      // Standard scale: 'a' -> 0, 'z' -> 2.0 (double brightness) or 1.0?
      // In Quake 2:
      // (s[k]-'a') / ('m'-'a') * 1.0 (so 'm' is 1.0)
      // 'm' - 'a' = 12.
      // So value = (char - 97) / 12.0

      const value = (charCode - 97) / 12.0;
      this.values[index] = value;
    }
  }

  getValues(): Float32Array {
    return this.values;
  }
}
