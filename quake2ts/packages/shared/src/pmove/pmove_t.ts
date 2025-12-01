import { PmoveCmd, PmoveTraceFn, PmovePointContentsFn } from './types.js';
import { PlayerState } from '../protocol/player-state.js';

export interface pmove_t {
  s: PlayerState;
  cmd: PmoveCmd;
  trace: PmoveTraceFn;
  pointcontents: PmovePointContentsFn;
  pm_type?: number;
  pm_flags?: number;
  pm_time?: number;
  gravity?: number;
  waterlevel?: number;
  watertype?: number;
  groundentity?: number;
}
