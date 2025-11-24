import { describe, it, expect } from 'vitest';
import { parseColorString, QUAKE2_COLORS } from '../../src/render/colors.js';

describe('Color Code Parsing', () => {
  it('should parse text without colors', () => {
    const segments = parseColorString('Hello World');
    expect(segments).toHaveLength(1);
    expect(segments[0].text).toBe('Hello World');
    expect(segments[0].color).toBeUndefined();
  });

  it('should parse text with color codes', () => {
    const segments = parseColorString('^1Red ^2Green ^3Yellow');
    expect(segments).toHaveLength(3);

    expect(segments[0].text).toBe('Red ');
    expect(segments[0].color).toEqual(QUAKE2_COLORS['1']);

    expect(segments[1].text).toBe('Green ');
    expect(segments[1].color).toEqual(QUAKE2_COLORS['2']);

    expect(segments[2].text).toBe('Yellow');
    expect(segments[2].color).toEqual(QUAKE2_COLORS['3']);
  });

  it('should handle trailing color codes', () => {
    const segments = parseColorString('Text^1');
    expect(segments).toHaveLength(1);
    expect(segments[0].text).toBe('Text');
    // The ^1 starts a new segment but has no text, so it is omitted?
    // Implementation: if (currentText.length > 0) push.
    // If trailing color code, loop finishes. If no text accumulated for that color, nothing pushed.
    // But the previous text was pushed when ^1 was encountered.
  });

  it('should handle invalid color codes', () => {
      const segments = parseColorString('^9Invalid');
      // ^9 is not in map. Should treat as literal text?
      // Current implementation: if (!QUAKE2_COLORS[code]), it continues and appends ^ and code to text.
      expect(segments).toHaveLength(1);
      expect(segments[0].text).toBe('^9Invalid');
  });
});
