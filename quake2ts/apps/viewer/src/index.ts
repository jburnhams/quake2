import { createClient } from '@quake2ts/client';
import { ClientRenderer, createEngine, createEngineRuntime } from '@quake2ts/engine';
import { createGame } from '@quake2ts/game';
import { ZERO_VEC3 } from '@quake2ts/shared';

import { Vec3 } from '@quake2ts/shared';

export function bootstrapViewer() {
  const trace = (start: Vec3, end: Vec3) => {
    return {
      start,
      end,
      fraction: 1,
      endpos: end,
      allsolid: false,
      startsolid: false,
    };
  };

  const engine = createEngine({
    trace,
  });

  const game = createGame(trace, { gravity: ZERO_VEC3 });

  const client = createClient({ engine: { trace } });

  const runtime = createEngineRuntime(engine, game, client as unknown as ClientRenderer);
  runtime.start();

  return { engine, game, client, runtime };
}
