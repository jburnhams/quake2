// A lab's numbers on sliders, each held in its own URL parameter so a setup can be linked and
// survives a reload. A value outside a slider's limits in a link is ignored (the default is used),
// never clamped, so a link never shows a number it did not hold.
import { useSearchParam } from 'strata-react';

export interface NumberParam<K extends string> {
  readonly key: K;
  /** The URL parameter. */
  readonly param: string;
  readonly label: string;
  /** What it does, in one sentence. */
  readonly hint: string;
  readonly min: number;
  readonly max: number;
  readonly step: number;
  readonly unit?: string;
}

export interface NumberParams<K extends string> {
  readonly values: Readonly<Record<K, number>>;
  readonly set: (key: K, value: number) => void;
  /** The params that differ from their defaults, in the order given. */
  readonly changed: readonly NumberParam<K>[];
}

function parseFor(p: NumberParam<string>) {
  return (raw: string) => {
    const n = Number(raw);
    return Number.isFinite(n) && n >= p.min && n <= p.max ? raw : undefined;
  };
}

/** The values of `params`, read from and written to the URL. `params` must be a fixed list. */
export function useNumberParams<K extends string>(params: readonly NumberParam<K>[], defaults: Readonly<Record<K, number>>): NumberParams<K> {
  // One hook per param, always in the same order (the list is fixed).
  const held = params.map((p) => [p, ...useSearchParam<string>(p.param, { default: String(defaults[p.key]), parse: parseFor(p) })] as const);
  const values = { ...defaults } as Record<K, number>;
  for (const [p, raw] of held) values[p.key] = Number(raw);
  return {
    values,
    set: (key, value) => held.find(([p]) => p.key === key)?.[2](String(value)),
    changed: held.filter(([p]) => values[p.key] !== defaults[p.key]).map(([p]) => p),
  };
}
