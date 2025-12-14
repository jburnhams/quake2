# Implementation Plan for Library Enhancements

This document outlines the steps to implement the requested features in `quake2ts`.

## Phase 1: DebugRenderer Upgrades

**Objective**: Enable rendering of solid 3D gizmos.

1.  **Refactor `DebugRenderer`**:
    *   Separate `wireframe` (LINES) and `solid` (TRIANGLES) buffers.
    *   Update `init()` to create two VAOs/Programs if needed, or use a single shader with a uniform for lighting (simple flat shading for solid primitives).

2.  **Implement Primitive Generators**:
    *   `addCone`: Generate vertices/indices for a cone approximation.
    *   `addTorus`: Generate vertices/indices for a ring.
    *   Ensure efficient batching (don't regenerate geometry every frame if possible, or use a "StaticMesh" pattern).

3.  **Depth Control**:
    *   Add `alwaysOnTop` boolean to `render()` or state method.
    *   When true, call `gl.disable(gl.DEPTH_TEST)` before drawing debug geometry, then restore.

## Phase 2: Gizmo System

**Objective**: Reusable Gizmo component in `quake2ts/engine`.

1.  **Create `Gizmo` class**:
    *   Composed of 3 Arrows (Translate) and 3 Rings (Rotate).
    *   Methods: `setPosition`, `setRotation`.
    *   Method: `draw(renderer: DebugRenderer)`.

2.  **Picking Logic**:
    *   Implement `intersectRayGizmo(ray: Ray, gizmo: Gizmo): GizmoPart | null`.
    *   Use analytical intersection (ray vs cylinder/cone, ray vs plane/torus) rather than mesh collision for precision.

## Phase 3: Entity Serialization

1.  **ENT Parser/Serializer**:
    *   Ensure `BspEntity` structure matches standard Quake 2 definitions.
    *   Write `serializeBspEntities(entities: BspEntity[]): string` that formats output matching the original `.ent` lump (compatible with Q2 compilers).

## Timeline
- **Phase 1**: 2 days
- **Phase 2**: 2 days
- **Phase 3**: 1 day
