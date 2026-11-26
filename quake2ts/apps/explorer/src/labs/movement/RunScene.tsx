// The movement lab's stage: demo1 in 3D (LabScene) with this run's path in amber and the game's
// in grey, and each player's box where it is at the playhead, so pressing play shows the move
// being made (Jonathan, 2026-11-26: "press play and see the player actually do the move"). From
// the side, the view starts on the game's run from its right, so a jump shows as an arc; through
// the player's eyes, the camera rides this run at the player's view height (22 units over the
// origin, as startState sets it) looking along the run's heading, and the grey box is the game's
// player running beside it.
import * as React from 'react';
import type { BspMap } from '@quake2ts/formats/bsp';
import { AMBER, GREY, LabScene, type LineColour, type Lines } from '../LabScene';
import { framePoints, type Orbit } from '../orbit';
import type { MovementFrame, MovementWorld } from './simulate';

type Vec = { readonly x: number; readonly y: number; readonly z: number };

const PLAYER_MINS = { x: -16, y: -16, z: -24 };
const PLAYER_MAXS = { x: 16, y: 16, z: 32 };
const VIEW_HEIGHT = 22;

export type RunCamera = 'side' | 'eyes';

export function RunScene({
  map,
  world,
  run,
  base,
  at,
  camera,
}: {
  map: BspMap;
  world: MovementWorld;
  run: readonly MovementFrame[];
  base: readonly MovementFrame[];
  /** Where each player is at the playhead; kept stable between frames (useMemo) so the scene redraws only when it moves. */
  at: { run: Vec; base: Vec };
  camera: RunCamera;
}) {
  const side = React.useMemo(() => framePoints(base.map((f) => f.origin)), [base]);
  const eyes = camera === 'eyes';
  const home = React.useMemo<Orbit>(
    () => (eyes ? { target: { x: at.run.x, y: at.run.y, z: at.run.z + VIEW_HEIGHT }, yaw: world.start.yaw, pitch: 0, distance: 64 } : side),
    // Through the eyes, the camera follows the player; from the side it stays where it was put.
    [eyes, side, world, eyes ? at : null],
  );
  const draw = React.useCallback(
    (lines: Lines) => {
      drawPath(lines, base, GREY);
      drawPath(lines, run, AMBER);
      drawPlayer(lines, at.base, GREY);
      if (!eyes) drawPlayer(lines, at.run, AMBER);
    },
    [run, base, eyes, at],
  );
  return (
    <LabScene
      label="The runs in 3D"
      shows={eyes ? "demo1 through this run's player's eyes, with the game's player in grey." : "demo1 with this run's path in amber and the game's in grey."}
      legend="Amber: this run. Grey: the game's values. A box is where each player is at the playhead."
      map={map}
      model={world.model}
      home={home}
      draw={draw}
      standAt={eyes}
    />
  );
}

/** A run's path as line segments through the player's origin. */
function drawPath(lines: Lines, frames: readonly MovementFrame[], colour: LineColour) {
  for (let i = 1; i < frames.length; i++) lines.line(frames[i - 1]!.origin, frames[i]!.origin, colour);
}

/** The player's box around an origin. */
function drawPlayer(lines: Lines, o: Vec, colour: LineColour) {
  lines.box(
    { x: o.x + PLAYER_MINS.x, y: o.y + PLAYER_MINS.y, z: o.z + PLAYER_MINS.z },
    { x: o.x + PLAYER_MAXS.x, y: o.y + PLAYER_MAXS.y, z: o.z + PLAYER_MAXS.z },
    colour,
  );
}
