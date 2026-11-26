// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { excerpt } from '../src/labs/source/excerpt';

// The labs cut functions out of id's source and the port's by name; these pin what comes out.
// id's files are in .id-source (scripts/fetch-id-source.sh, run by vite.config.ts).
const root = new URL('../../../', import.meta.url);
const idSource = new URL('../../../.id-source/', import.meta.url);
const read = (path: string) => readFileSync(path.startsWith('packages/') ? new URL(path, root) : new URL(path, idSource), 'utf8');

describe('excerpt', () => {
  it('cuts a C++ function with its body and no more', () => {
    const e = excerpt(read('rerelease/p_move.cpp'), 'void PM_Accelerate(const vec3_t &wishdir');
    expect(e.code).toContain('void PM_Accelerate(const vec3_t &wishdir, float wishspeed, float accel)');
    expect(e.code.trim().endsWith('}')).toBe(true);
    expect(e.code).toContain('currentspeed = pml.velocity.dot(wishdir);');
    expect(e.code).not.toContain('PM_AirAccelerate');
    expect(read('rerelease/p_move.cpp').split('\n')[e.lastLine - 1]).toBe('}');
  });

  it("takes the 1997 source's banner comment with the function", () => {
    const e = excerpt(read('full/qcommon/pmove.c'), 'void PM_Accelerate (vec3_t wishdir');
    expect(e.code.split('\n')[0]).toBe('/*');
    expect(e.code).toContain('Handles user intended acceleration');
  });

  it('takes a TypeScript function with its doc comment', () => {
    const e = excerpt(read('packages/shared/src/pmove/pmove.ts'), 'export function applyPmoveAirAccelerate(');
    expect(e.code.startsWith('/**')).toBe(true);
    expect(e.code).toContain('Math.min(wishspeed, 30)');
    expect(e.code.trim().endsWith('}')).toBe(true);
  });

  it('cuts an if and its else, dedented', () => {
    const e = excerpt(read('packages/shared/src/pmove/move.ts'), 'if (pmAirAccelerate > 0) {', { comment: false });
    expect(e.code.split('\n')[0]).toBe('if (pmAirAccelerate > 0) {');
    expect(e.code).toContain('} else {');
    expect(e.code.trim().endsWith('}')).toBe(true);
    expect(e.code).not.toContain('Grapple');
  });

  it('says when a name is not there', () => {
    expect(() => excerpt('int main() {}', 'PM_Nothing')).toThrow(/PM_Nothing/);
  });
});
