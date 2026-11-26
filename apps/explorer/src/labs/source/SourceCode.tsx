// The code a lab runs, shown beside it: id's original and the port, each cut from the file itself
// (excerpt.ts) so what is shown is what runs, with where it came from, its licence and a link to
// the lines. id's files are read from .id-source (scripts/fetch-id-source.sh, pinned in
// scripts/id-source.pins) and linked in id's own repositories at those pinned commits. id's code is GPL-2.0, as the port is; the attribution line says so on every
// excerpt. Two excerpts sit side by side on a wide screen and one above the other on a narrow one.
// strata-react has no code block yet, so this is a plain <pre> on the theme's roles.
import * as React from 'react';
import { TextLink } from 'strata-react';
import type { Excerpt } from './excerpt';

const PORT_REPO = 'https://github.com/jburnhams/quake2/blob/main';
// The commits pinned in scripts/id-source.pins.
const RERELEASE_REPO = 'https://github.com/id-Software/quake2-rerelease-dll/blob/8dc1fc9794c01ece06881e703851b768fb3994de';
const ORIGINAL_REPO = 'https://github.com/id-Software/Quake-2/blob/372afde46e7defc9dd2d719a1732b8ace1fa096e';

/** Where a file comes from, and under what licence. */
export interface SourceFile {
  /** Its path as shown: "rerelease/p_move.cpp" (id's, as laid out in .id-source) or "packages/…" (the port's). */
  readonly path: string;
  /** The file on GitHub, without a line anchor. */
  readonly href: string;
  /** Who wrote it: "id Software, Quake II rerelease (2023)". */
  readonly by: string;
  readonly licence: string;
}

export const RERELEASE = (file: string): SourceFile => ({ path: `rerelease/${file}`, href: `${RERELEASE_REPO}/rerelease/${file}`, by: 'id Software, the 2023 rerelease game code (© ZeniMax Media)', licence: 'GPL-2.0' });
export const ORIGINAL = (file: string): SourceFile => ({ path: `full/${file}`, href: `${ORIGINAL_REPO}/${file}`, by: 'id Software, the 1997 source release', licence: 'GPL-2.0' });
export const PORT = (file: string): SourceFile => ({ path: file, href: `${PORT_REPO}/${file}`, by: 'the TypeScript port', licence: 'GPL-2.0' });

export function SourceCode({ title, file, excerpt }: { title: string; file: SourceFile; excerpt: Excerpt }) {
  const lines = `${excerpt.firstLine}–${excerpt.lastLine}`;
  return (
    <figure className="grid min-w-0 content-start gap-2">
      <figcaption className="grid gap-0.5">
        <span className="type-label">{title}</span>
        <span className="type-caption text-muted-foreground">
          <TextLink href={`${file.href}#L${excerpt.firstLine}-L${excerpt.lastLine}`}>
            {file.path}, lines {lines}
          </TextLink>
          . By {file.by}, {file.licence}.
        </span>
      </figcaption>
      <pre className="overflow-x-auto rounded-surface border border-border bg-muted p-3 font-mono type-caption leading-relaxed">
        <code>{excerpt.code}</code>
      </pre>
    </figure>
  );
}

/** id's code and the port's, side by side, under one heading and a sentence on what to look for. */
export function SourcePair({ heading, children, note }: { heading: string; note: React.ReactNode; children: React.ReactNode }) {
  const id = React.useId();
  return (
    <section aria-labelledby={id} className="grid gap-3">
      <h3 id={id} className="type-heading">
        {heading}
      </h3>
      <p className="type-body-sm text-muted-foreground">{note}</p>
      <div className="grid gap-4 lg:grid-cols-2">{children}</div>
    </section>
  );
}

/** Write-ups worth reading next, each with who wrote it and what it adds. */
export function FurtherReading({ items }: { items: readonly { title: string; href: string; by: string; adds: string }[] }) {
  const id = React.useId();
  return (
    <section aria-labelledby={id} className="grid gap-2">
      <h3 id={id} className="type-heading">
        Further reading
      </h3>
      <ul className="grid gap-2">
        {items.map((r) => (
          <li key={r.href} className="type-body-sm">
            <TextLink href={r.href}>{r.title}</TextLink> <span className="text-muted-foreground">({r.by})</span>: {r.adds}
          </li>
        ))}
      </ul>
    </section>
  );
}
