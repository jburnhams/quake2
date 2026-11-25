# strata-math

3D math with no dependencies: plain-object vectors, column-major `Float32Array` matrices, Euler
angles, convex polygon (winding) clipping, and a seeded MT19937 generator whose output matches
C++ `std::mt19937`. General tier of the library split (see [`../../LIBRARIES.md`](../../LIBRARIES.md)).

| Entry | Holds |
|---|---|
| `strata-math/vec3` | `Vec3 {x,y,z}`, `Bounds3`, `Mat3`; add, scale, dot, cross, normalize, distance, box tests, velocity clipping against planes, slerp, rotation about an axis |
| `strata-math/angles` | `PITCH`/`YAW`/`ROLL` (degrees), `angleVectors` (forward, right, up), `vectorToAngles`, `vectorToYaw`, `lerpAngle`, `angleMod` |
| `strata-math/mat4` | identity, multiply, translate, perspective, ortho, `mat4FromBasis`, `transformPointMat4` |
| `strata-math/winding` | convex polygons on planes: base winding for a plane, clip, split, area, bounds, plane side tests |
| `strata-math/random` | `MersenneTwister19937` (state save and restore), `RandomGenerator` (`frandom`, `crandom`, `irandom`) |

`strata-math` (the root) re-exports all five. Vectors are immutable values: every helper returns a
new object.

`@quake2ts/shared` re-exports these unchanged from its old paths (`src/math/*.ts`), so existing
imports keep working.
