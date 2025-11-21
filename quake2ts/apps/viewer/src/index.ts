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

  const pointContents = (point: Vec3) => 0;

  const engine = createEngine({
    trace,
  });

  const gameEngine = {
    sound: (entity: number, channel: number, sound: string) => console.log(`Sound played: ${sound}`),
    centerprintf(entity: number, message: string) {
      const el = document.createElement('div');
      el.style.position = 'absolute';
      el.style.top = '50%';
      el.style.left = '50%';
      el.style.transform = 'translate(-50%, -50%)';
      el.style.color = 'white';
      el.style.fontSize = '2em';
      el.style.fontFamily = 'sans-serif';
      el.innerText = message;
      document.body.appendChild(el);
      setTimeout(() => document.body.removeChild(el), 3000);
    },
  };

  const game = createGame({ trace, pointContents }, gameEngine as any, { gravity: ZERO_VEC3 });

  const client = createClient({ engine: { trace } });

  const runtime = createEngineRuntime(engine, game, client as unknown as ClientRenderer);
  runtime.start();

  return { engine, game, client, runtime };
}
