import { createClient } from '@quake2ts/client';
import { createEngine } from '@quake2ts/engine';
import { createGame } from '@quake2ts/game';
import { ZERO_VEC3 } from '@quake2ts/shared';

export function bootstrapViewer() {
  const engine = createEngine({
    trace(start, end) {
      return { start, end, fraction: 1 };
    },
  });

  const game = createGame({
    trace(start, end) {
      return { start, end, fraction: 1 };
    },
  }, { gravity: ZERO_VEC3 });

  const client = createClient({ engine: { trace: () => ({ start: ZERO_VEC3, end: ZERO_VEC3, fraction: 1 }) } });

  engine.init();
  game.init();
  client.init();

  return { engine, game, client };
}
