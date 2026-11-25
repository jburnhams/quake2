// The constants the movement lab puts on sliders, each held in the URL so a setup can be linked
// and survives a reload. Only those the scripted run exercises are here: water and duck speeds
// stay at the game's values until the run swims or crouches.
import { useNumberParams, type NumberParam, type NumberParams } from '../params';
import { DEFAULT_LAB_TUNING, type LabTuning } from './simulate';

export type TunedKey = 'gravity' | 'jumpSpeed' | 'maxSpeed' | 'accelerate' | 'airAccelerate' | 'friction' | 'stopSpeed' | 'stepSize';
export type Constant = NumberParam<TunedKey>;

export const CONSTANTS: readonly Constant[] = [
  { key: 'gravity', param: 'gravity', label: 'Gravity', hint: 'sv_gravity: how fast a falling player speeds up.', min: 0, max: 1600, step: 10, unit: 'u/s²' },
  { key: 'jumpSpeed', param: 'jump', label: 'Jump speed', hint: 'The upward speed a jump starts with.', min: 0, max: 600, step: 10, unit: 'u/s' },
  { key: 'maxSpeed', param: 'maxspeed', label: 'Top speed', hint: 'pm_maxspeed: the fastest a player can ask to run.', min: 50, max: 800, step: 10, unit: 'u/s' },
  { key: 'accelerate', param: 'accel', label: 'Ground acceleration', hint: 'pm_accelerate: how quickly a player reaches top speed on the ground.', min: 0.5, max: 30, step: 0.5 },
  { key: 'airAccelerate', param: 'airaccel', label: 'Air acceleration', hint: 'sv_airaccelerate: 0 is the game as it ships (a little steering in the air); above 0 is Quake-style air strafing at that rate.', min: 0, max: 20, step: 0.5 },
  { key: 'friction', param: 'friction', label: 'Friction', hint: 'pm_friction: how quickly a player slows on the ground after letting go.', min: 0, max: 20, step: 0.5 },
  { key: 'stopSpeed', param: 'stopspeed', label: 'Stop speed', hint: 'pm_stopspeed: below this, friction acts as if at this speed, so a player stops rather than creeps.', min: 0, max: 400, step: 10, unit: 'u/s' },
  { key: 'stepSize', param: 'step', label: 'Step height', hint: 'STEPSIZE: the highest ledge a player walks up without jumping.', min: 0, max: 64, step: 1, unit: 'u' },
];

export interface LabTuningState extends NumberParams<TunedKey> {
  readonly tuning: LabTuning;
}

/** The lab's constants, read from and written to the URL. */
export function useLabTuning(): LabTuningState {
  const { values, set, changed } = useNumberParams(CONSTANTS, DEFAULT_LAB_TUNING);
  return { values, set, changed, tuning: { ...DEFAULT_LAB_TUNING, ...values } };
}
