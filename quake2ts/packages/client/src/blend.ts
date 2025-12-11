import { PlayerState, PlayerStat } from '@quake2ts/shared';

export interface BlendState {
  damageAlpha: number;
  bonusAlpha: number;
  lastFlashes: number;
}

export const createBlendState = (): BlendState => ({
  damageAlpha: 0,
  bonusAlpha: 0,
  lastFlashes: 0
});

export const updateBlend = (
  state: BlendState,
  ps: PlayerState,
  dt: number,
  damageIntensity: number = 0
): [number, number, number, number] => {
  // Update damage alpha
  state.damageAlpha -= dt;
  if (state.damageAlpha < 0) state.damageAlpha = 0;

  if (damageIntensity > 0) {
      state.damageAlpha = damageIntensity;
  }

  // Update bonus alpha
  state.bonusAlpha -= dt;
  if (state.bonusAlpha < 0) state.bonusAlpha = 0;

  // Check for flashes (pickups)
  const flashes = ps.stats ? (ps.stats[PlayerStat.STAT_FLASHES] ?? 0) : 0;

  if (flashes !== state.lastFlashes) {
      state.bonusAlpha = 0.6;
      state.lastFlashes = flashes;
  }

  if (state.bonusAlpha > 0) {
      return [1, 1, 0, state.bonusAlpha * 0.3];
  } else if (state.damageAlpha > 0) {
      return [1, 0, 0, state.damageAlpha * 0.5];
  }

  return [0, 0, 0, 0];
};
