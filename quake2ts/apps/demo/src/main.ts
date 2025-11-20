
import { createEngine, FixedStepContext, RenderContext } from '@quake2ts/engine';
import { createClient } from '@quake2ts/client';
import { createGame } from '@quake2ts/game';
import { Vec3 } from '@quake2ts/shared';

const engine = createEngine({});

const game = createGame(engine.trace, engine.pointContents, {
  gravity: { x: 0, y: 0, z: -800 },
});

const client = createClient({ engine });

const host = engine.createMainLoop({
  simulate: (step: FixedStepContext) => {
    game.frame(step);
  },
  render: (context: RenderContext) => {
    client.render(context);
  },
});

host.start();
