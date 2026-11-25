// The constants the movement lab puts on sliders, each held in the URL so a setup can be linked
// and survives a reload. Only those the scripted run exercises are here: water and duck speeds
// stay at the game's values until the run swims or crouches.
import { useSearchParam } from 'strata-react';
import { DEFAULT_LAB_TUNING, type LabTuning } from './simulate';

export type TunedKey = 'gravity' | 'jumpSpeed' | 'maxSpeed' | 'accelerate' | 'airAccelerate' | 'friction' | 'stopSpeed' | 'stepSize';

export interface Constant {
  readonly key: TunedKey;
  /** The URL parameter. */
  readonly param: string;
  readonly label: string;
  /** What it does in the game, in one sentence. */
  readonly hint: string;
  readonly min: number;
  readonly max: number;
  readonly step: number;
  readonly unit?: string;
}

export const CONSTANTS: readonly Constant[] = [
  { key: 'gravity', param: 'gravity', label: 'Gravity', hint: 'sv_gravity: how fast a falling player speeds up.', min: 0, max: 1600, step: 10, unit: 'u/s²' },
  { key: 'jumpSpeed', param: 'jump', label: 'Jump speed', hint: 'The upward speed a jump starts with.', min: 0, max: 600, step: 10, unit: 'u/s' },
  { key: 'maxSpeed', param: 'maxspeed', label: 'Top speed', hint: 'pm_maxspeed: the fastest a player can ask to run.', min: 50, max: 800, step: 10, unit: 'u/s' },
  { key: 'accelerate', param: 'accel', label: 'Ground acceleration', hint: 'pm_accelerate: how quickly a player reaches top speed on the ground.', min: 0.5, max: 30, step: 0.5 },
  { key: 'airAccelerate', param: 'airaccel', label: 'Air acceleration', hint: 'pm_airaccelerate: how much a player can steer in the air.', min: 0, max: 20, step: 0.5 },
  { key: 'friction', param: 'friction', label: 'Friction', hint: 'pm_friction: how quickly a player slows on the ground after letting go.', min: 0, max: 20, step: 0.5 },
  { key: 'stopSpeed', param: 'stopspeed', label: 'Stop speed', hint: 'pm_stopspeed: below this, friction acts as if at this speed, so a player stops rather than creeps.', min: 0, max: 400, step: 10, unit: 'u/s' },
  { key: 'stepSize', param: 'step', label: 'Step height', hint: 'STEPSIZE: the highest ledge a player walks up without jumping.', min: 0, max: 64, step: 1, unit: 'u' },
];

/** Parses a URL value for a constant: a number inside its limits, else the default. */
function parseFor(c: Constant) {
  return (raw: string) => {
    const n = Number(raw);
    return Number.isFinite(n) && n >= c.min && n <= c.max ? raw : undefined;
  };
}

export interface LabTuningState {
  readonly tuning: LabTuning;
  readonly set: (key: TunedKey, value: number) => void;
  /** The constants that differ from the game's. */
  readonly changed: readonly Constant[];
}

/** The lab's constants, read from and written to the URL. */
export function useLabTuning(): LabTuningState {
  // One hook per constant, always in the same order (CONSTANTS is fixed).
  const params = CONSTANTS.map((c) => [c, ...useSearchParam<string>(c.param, { default: String(DEFAULT_LAB_TUNING[c.key]), parse: parseFor(c) })] as const);
  const tuning: LabTuning = { ...DEFAULT_LAB_TUNING };
  for (const [c, raw] of params) (tuning as Record<TunedKey, number>)[c.key] = Number(raw);
  return {
    tuning,
    set: (key, value) => params.find(([c]) => c.key === key)?.[2](String(value)),
    changed: params.filter(([c]) => tuning[c.key] !== DEFAULT_LAB_TUNING[c.key]).map(([c]) => c),
  };
}
