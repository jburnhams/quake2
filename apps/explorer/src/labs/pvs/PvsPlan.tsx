// demo1 from above: every floor the eye's level or below, each filled by its fate from the eye
// (pvs.ts), the upper floors drawn over the lower. A click on a floor moves the eye there, at a
// player's eye height above it; the sliders beside the stage do the same from the keyboard. Floors
// above the eye are left out, so the plan is a cutaway at the eye's height and a click lands on
// the floor the player would stand on. Drawn in SVG with the theme's roles, so it follows light and
// dark. The SVG keeps the map's own aspect (preserveAspectRatio none, sized by aspect-ratio), so a
// click's position in the box is a straight scale of the map's coordinates.
import * as React from 'react';
import type { Vec } from '../orbit';
import { floorHeight, type Floor, type FloorFate, type PvsView } from './pvs';

/** How far above a floor a player's eye is: the box's 24 below the origin and the 22 of viewheight. */
export const EYE_HEIGHT = 46;
/** Floors whose top is up to this far above the eye still show (a step or a low ledge). */
const ABOVE_EYE = 24;

export const FATE_WORDS: Record<FloorFate, string> = {
  here: "The eye's own cluster",
  drawn: 'In its PVS, drawn',
  door: 'In its PVS, behind a closed door',
  hidden: 'Not in its PVS, never drawn',
};

const FATE_CLASS: Record<FloorFate, string> = {
  here: 'text-primary',
  drawn: 'text-info',
  door: 'text-warning',
  hidden: 'text-muted-foreground',
};

export interface Bounds {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

export function planBounds(floors: readonly Floor[]): Bounds {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const f of floors)
    for (const [x, y] of f.points) {
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  const pad = 32;
  return { minX: minX - pad, minY: minY - pad, maxX: maxX + pad, maxY: maxY + pad };
}

/** The topmost shown floor under a point of the plan, and the eye a player standing there would have. */
export function eyeOnFloor(floors: readonly Floor[], eyeZ: number, x: number, y: number): Vec | null {
  for (let i = floors.length - 1; i >= 0; i--) {
    const f = floors[i]!;
    if (f.top > eyeZ + ABOVE_EYE || !inside(f.points, x, y)) continue;
    return { x, y, z: Math.round(floorHeight(f, x, y) + EYE_HEIGHT) };
  }
  return null;
}

function inside(points: readonly (readonly [number, number])[], x: number, y: number): boolean {
  let hit = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [xi, yi] = points[i]!;
    const [xj, yj] = points[j]!;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

export function PvsPlan({ floors, view, yaw, onPick }: { floors: readonly Floor[]; view: PvsView; yaw: number; onPick: (eye: Vec) => void }) {
  const id = React.useId();
  const b = React.useMemo(() => planBounds(floors), [floors]);
  const w = b.maxX - b.minX;
  const h = b.maxY - b.minY;
  const shown = floors.filter((f) => f.top <= view.eye.z + ABOVE_EYE);
  const px = (x: number) => x - b.minX;
  const py = (y: number) => b.maxY - y;
  const facing = (yaw * Math.PI) / 180;
  const reach = 96;

  const onClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    if (!box.width || !box.height) return;
    const x = Math.round(b.minX + ((e.clientX - box.left) / box.width) * w);
    const y = Math.round(b.maxY - ((e.clientY - box.top) / box.height) * h);
    const eye = eyeOnFloor(floors, view.eye.z, x, y);
    if (eye) onPick(eye);
  };

  return (
    <figure className="grid gap-2">
      <svg
        viewBox={`0 0 ${w} ${h}`}
        preserveAspectRatio="none"
        style={{ aspectRatio: `${w} / ${h}` }}
        className="w-full cursor-crosshair rounded-surface border border-border bg-card"
        role="img"
        aria-labelledby={`${id}-cap`}
        onClick={onClick}
      >
        {shown.map((f) => {
          const fate = view.fate.get(f.face) ?? 'hidden';
          return (
            <polygon
              key={f.face}
              data-fate={fate}
              points={f.points.map(([x, y]) => `${px(x)},${py(y)}`).join(' ')}
              className={FATE_CLASS[fate]}
              fill="currentColor"
              fillOpacity={fate === 'hidden' ? 0.18 : 0.75}
              stroke="currentColor"
              strokeOpacity={0.5}
              strokeWidth={2}
            />
          );
        })}
        <g className="text-foreground" stroke="currentColor" strokeWidth={8} strokeLinecap="round">
          <line x1={px(view.eye.x)} y1={py(view.eye.y)} x2={px(view.eye.x + Math.cos(facing) * reach)} y2={py(view.eye.y + Math.sin(facing) * reach)} />
          <circle cx={px(view.eye.x)} cy={py(view.eye.y)} r={28} fill="none" />
        </g>
      </svg>
      <figcaption id={`${id}-cap`} className="grid gap-1 type-body-sm text-muted-foreground">
        <span>
          demo1 from above, north up: the floors at the eye's height and below, filled by what the renderer does with them from the eye (the ring, its line the way the 3D view faces). Click a floor to stand on it.
        </span>
        <span className="flex flex-wrap gap-x-4 gap-y-1">
          {(Object.keys(FATE_WORDS) as FloorFate[]).map((fate) => (
            <span key={fate} className="inline-flex items-center gap-1.5">
              <svg viewBox="0 0 10 10" className={`size-3 ${FATE_CLASS[fate]}`} aria-hidden>
                <rect width={10} height={10} fill="currentColor" fillOpacity={fate === 'hidden' ? 0.3 : 0.8} />
              </svg>
              {FATE_WORDS[fate]}
            </span>
          ))}
        </span>
      </figcaption>
    </figure>
  );
}
