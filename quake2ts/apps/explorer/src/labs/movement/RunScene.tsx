// The movement lab's stage: demo1 in 3D (LabScene) with this run's path in amber and the game's
// in grey, and the player's box where each run ends. The view starts on the game's run from its
// right side, so a jump shows as an arc.
import * as React from 'react';
import type { BspMap } from '@quake2ts/formats/bsp';
import { AMBER, GREY, LabScene, type LineColour, type Lines } from '../LabScene';
import { framePoints } from '../orbit';
import type { MovementFrame, MovementWorld } from './simulate';

const PLAYER_MINS = { x: -16, y: -16, z: -24 };
const PLAYER_MAXS = { x: 16, y: 16, z: 32 };

export function RunScene({ map, world, run, base }: { map: BspMap; world: MovementWorld; run: readonly MovementFrame[]; base: readonly MovementFrame[] }) {
  const home = React.useMemo(() => framePoints(base.map((f) => f.origin)), [base]);
  const draw = React.useCallback(
    (lines: Lines) => {
      drawPath(lines, base, GREY);
      drawPath(lines, run, AMBER);
    },
    [run, base],
  );
  return (
    <LabScene
      label="The runs in 3D"
      shows="demo1 with this run's path in amber and the game's in grey."
      legend="Amber: this run. Grey: the game's values. A box marks where each run ends."
      map={map}
      model={world.model}
      home={home}
      draw={draw}
    />
  );
}

/** A run's path as line segments through the player's origin, and its box where it ends. */
function drawPath(lines: Lines, frames: readonly MovementFrame[], colour: LineColour) {
  for (let i = 1; i < frames.length; i++) lines.line(frames[i - 1]!.origin, frames[i]!.origin, colour);
  const end = frames.at(-1)?.origin;
  if (!end) return;
  lines.box(
    { x: end.x + PLAYER_MINS.x, y: end.y + PLAYER_MINS.y, z: end.z + PLAYER_MINS.z },
    { x: end.x + PLAYER_MAXS.x, y: end.y + PLAYER_MAXS.y, z: end.z + PLAYER_MAXS.z },
    colour,
  );
}
