export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Subtracts a list of holes from a starting rectangle, returning a list of smaller rectangles.
 * This is useful for creating walls with openings.
 */
export function subtractRects(rect: Rect, holes: Rect[]): Rect[] {
  let rects = [rect];

  for (const hole of holes) {
    const nextRects: Rect[] = [];
    for (const r of rects) {
      // Check intersection
      const x1 = Math.max(r.x, hole.x);
      const y1 = Math.max(r.y, hole.y);
      const x2 = Math.min(r.x + r.w, hole.x + hole.w);
      const y2 = Math.min(r.y + r.h, hole.y + hole.h);

      if (x1 < x2 && y1 < y2) {
        // Intersect, so we need to split r

        // 1. Top rect (if any)
        // Spans full width of r
        if (hole.y > r.y) {
          nextRects.push({
            x: r.x,
            y: r.y,
            w: r.w,
            h: hole.y - r.y
          });
        }

        // 2. Bottom rect (if any)
        // Spans full width of r
        if (hole.y + hole.h < r.y + r.h) {
          nextRects.push({
            x: r.x,
            y: hole.y + hole.h,
            w: r.w,
            h: (r.y + r.h) - (hole.y + hole.h)
          });
        }

        // For Left and Right, we only consider the vertical slice that contains the hole
        // to avoid overlapping with Top and Bottom.
        const yStart = Math.max(r.y, hole.y);
        const yEnd = Math.min(r.y + r.h, hole.y + hole.h);
        const h = yEnd - yStart;

        // 3. Left rect (if any)
        if (hole.x > r.x) {
          nextRects.push({
            x: r.x,
            y: yStart,
            w: hole.x - r.x,
            h: h
          });
        }

        // 4. Right rect (if any)
        if (hole.x + hole.w < r.x + r.w) {
          nextRects.push({
            x: hole.x + hole.w,
            y: yStart,
            w: (r.x + r.w) - (hole.x + hole.w),
            h: h
          });
        }
      } else {
        // No intersection, keep original
        nextRects.push(r);
      }
    }
    rects = nextRects;
  }

  return rects;
}
