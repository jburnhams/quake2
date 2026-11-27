// A function cut out of a source file, so a lab shows the code it runs beside the slider that
// changes it: id's C or C++ from the repository's copy of the original source, and the port's
// TypeScript. Cut by name rather than by line number, so an edit above it in either file does not
// shift the excerpt; the lines it came from are kept for the link to the file.

export interface Excerpt {
  readonly code: string;
  /** 1-based, inclusive: the lines in the file, for a link. */
  readonly firstLine: number;
  readonly lastLine: number;
}

/**
 * The declaration that starts on the first line containing `start`, with the comment block right
 * above it, to the brace that closes its body. Pass `upTo` to stop at the first line after `start`
 * that contains it instead (for a branch inside a function), `comment: false` to leave the
 * comment above out, and `definition: true` to pass over declarations (a line ending in `;`, as a C
 * prototype above the function does). Throws when `start` is not in the file, so a renamed function fails a test
 * rather than showing nothing.
 */
export function excerpt(text: string, start: string, options: { upTo?: string; comment?: boolean; definition?: boolean } = {}): Excerpt {
  const lines = text.split('\n');
  const at = lines.findIndex((l) => l.includes(start) && !(options.definition && l.trim().endsWith(';')));
  if (at < 0) throw new Error(`"${start}" is not in the source.`);

  let first = at;
  if (options.comment !== false) first = commentAbove(lines, at);

  let last = at;
  if (options.upTo !== undefined) {
    const end = lines.findIndex((l, i) => i > at && l.includes(options.upTo!));
    if (end < 0) throw new Error(`"${options.upTo}" does not follow "${start}".`);
    last = end;
  } else {
    let depth = 0;
    let opened = false;
    for (let i = at; i < lines.length; i++) {
      for (const ch of stripStrings(lines[i]!)) {
        if (ch === '{') (depth++, (opened = true));
        else if (ch === '}') depth--;
      }
      last = i;
      if (opened && depth <= 0) break;
    }
  }

  const cut = lines.slice(first, last + 1);
  return { code: dedent(cut).join('\n'), firstLine: first + 1, lastLine: last + 1 };
}

/** The first line of the comment that ends right above line `at`: a block comment, or a run of // lines. */
function commentAbove(lines: string[], at: number): number {
  let i = at - 1;
  if (i >= 0 && lines[i]!.trim().endsWith('*/')) {
    while (i >= 0 && !lines[i]!.trim().startsWith('/*')) i--;
    return Math.max(i, 0);
  }
  while (i >= 0 && lines[i]!.trim().startsWith('//')) i--;
  return i + 1;
}

/** A line without its string literals and trailing comment, so a brace inside one is not counted. */
function stripStrings(line: string): string {
  return line.replace(/(["'`])(?:\\.|(?!\1).)*\1/g, '').replace(/\/\/.*$/, '');
}

/** Removes the indent every non-blank line shares. Tabs are counted as one column. */
function dedent(lines: string[]): string[] {
  const indents = lines.filter((l) => l.trim()).map((l) => l.match(/^[\t ]*/)![0].length);
  const cut = indents.length ? Math.min(...indents) : 0;
  return lines.map((l) => l.slice(cut).replace(/\t/g, '    ').replace(/\s+$/, ''));
}
