# Physics and Collision

This document tracks the ongoing work to implement a faithful and robust physics and collision system for the Quake II TypeScript port. It serves as a central repository for research, analysis, and a detailed task list, updated to reflect the discovery of the original engine's collision code.

## Original Implementation Notes

The full source code for the original Quake II engine has been located in the `full` directory. The core collision detection and tracing functions, including the fabled `CM_BoxTrace`, have been found in `full/qcommon/cmodel.c`. This C code is now the ground truth for our TypeScript port.

The `CM_BoxTrace` function sweeps an axis-aligned bounding box (the "hull") through a BSP tree. It recursively checks for collisions with the brushes that make up the world geometry. The key goal is to find the nearest collision, if any, and return detailed information about it.

The `trace_t` struct, defined in `full/qcommon/qcommon.h`, provides the following information about a collision:

- `allsolid`: `true` if the trace started and ended entirely inside solid geometry.
- `startsolid`: `true` if the trace started inside solid geometry.
- `fraction`: The percentage of the trace that was completed before a collision occurred (0.0 to 1.0).
- `endpos`: The position where the collision occurred.
- `plane`: The plane of the surface that was hit.
- `surface`: The surface that was hit (contains texture and flags).
- `contents`: The contents of the brush that was hit (e.g., solid, water, lava).

### Core Algorithm

The collision detection process can be broken down into three main parts:

1.  **`CM_BoxTrace` (The Entry Point)**: This is the main function. It initializes a `trace_t` struct, sets up global variables with the trace parameters (start, end, mins, maxs), and handles special cases like point traces (zero-sized bounding box) and position tests (zero-length trace). It then calls `CM_RecursiveHullCheck` to begin the BSP traversal.

2.  **`CM_RecursiveHullCheck` (BSP Traversal)**: This function recursively descends the BSP tree. At each node, it determines which side(s) of the node's splitting plane the bounding box intersects. If the box crosses the plane, the function calculates the intersection point and splits the trace into two segments, continuing the recursive check on both sides of the plane. This efficiently culls large parts of the world geometry that are not in the path of the trace.

3.  **`CM_ClipBoxToBrush` (Brush Collision)**: When the recursive traversal reaches a leaf node in the BSP tree, it checks the bounding box against all the brushes within that leaf. This function iterates through the planes that define a brush and calculates the `enterfrac` (the fraction at which the box enters the brush) and `leavefrac` (the fraction at which it leaves). If the box starts outside and the `enterfrac` is less than the `leavefrac`, a valid collision has occurred.

An important detail is the use of `DIST_EPSILON` (0.03125). This small value is used to push the intersection point slightly away from the collision plane. This helps to prevent the physics simulation from getting stuck on surfaces due to floating-point inaccuracies.

#### Analysis of CM_RecursiveHullCheck

1.  **Check for early exit:** If the trace has already found a closer collision, exit.
2.  **Check for leaf node:** If the current node is a leaf, trace against the brushes in that leaf and exit.
3.  **Calculate distances to splitting plane:** Calculate the distance from the start and end points of the trace to the splitting plane of the current node.
4.  **Calculate offset:** Calculate the offset of the bounding box from the splitting plane.
5.  **Check which side of the plane the trace is on:**
    *   If the trace is entirely on the front side, recurse into the front child.
    *   If the trace is entirely on the back side, recurse into the back child.
6.  **If the trace crosses the plane:**
    *   Calculate `frac` and `frac2`, the fractions at which the leading and trailing edges of the bounding box cross the plane.
    *   Recurse into the near side of the plane, from the start of the trace to the intersection point.
    *   Recurse into the far side of the plane, from the intersection point to the end of the trace.

## TypeScript Implementation Analysis

The existing TypeScript implementation in `packages/shared/src/bsp/collision.ts` is a good starting point, but it must now be rigorously tested against the original C code's behavior. The `traceBox` function is the equivalent of `CM_BoxTrace`, and the `TraceResult` interface is analogous to the `trace_t` struct.

This effort is now focused on creating an exhaustive, behavior-driven test suite that directly verifies the `traceBox` implementation against scenarios derived from the C code.

## Task List

The primary goal is to achieve behavioral parity with the original `CM_BoxTrace` function through a Test-Driven Development (TDD) approach.

- [x] Locate and analyze the original `CM_BoxTrace` C code.
- [x] Update this document with a detailed analysis of the algorithm.
- [x] Review existing tests in `packages/shared/tests/bsp/trace.test.ts`.
- [x] Create a helper module to generate simple, verifiable BSP data fixtures for testing. (Existing helpers can be used and extended).
- [x] **TDD Cycle: Simple Traces**
    - [x] Write a test for a trace that has no collision and fully completes (`fraction: 1.0`).
    - [x] Write a test for a trace that collides with a single, axis-aligned plane.
    - [x] Write a test for a trace that collides with a simple, convex brush made of multiple planes.
- [x] **TDD Cycle: Solid and Contained Traces**
    - [x] Write a test for a trace that starts inside a solid brush (`startsolid: true`).
    - [x] Write a test for a trace that both starts and ends inside a solid brush (`allsolid: true`, `startsolid: true`).
    - [x] Write a test for a zero-length trace (position test) that is inside a brush.
    - [x] Write a test for a zero-length trace that is outside any brushes.
- [x] **TDD Cycle: Epsilon and Grazing**
    - [x] Write a test that specifically validates the `DIST_EPSILON` behavior. The trace should stop slightly before the actual plane.
    - [x] Write a test for a trace that runs parallel to and "grazes" a brush surface.
- [x] **TDD Cycle: Complex Geometry**
    - [x] Write tests for traces that collide with internal corners (concave geometry).
    - [ ] Write tests for traces that collide with external corners (convex geometry).
    - [ ] Write tests that require the BSP tree traversal to split the trace and check multiple leaves.
- [ ] Refine the `traceBox` implementation in `packages/shared/src/bsp/collision.ts` to pass all new tests.
- [x] Update `section-3-physics-collision.md` with progress.
