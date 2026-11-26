import { DebugRenderer, Color } from './debug.js';
import { Vec3, Mat4 } from '@quake2ts/shared';
import { vec3, mat4 } from 'gl-matrix';

export enum GizmoPart {
    None,
    XAxis,
    YAxis,
    ZAxis,
    XRing,
    YRing,
    ZRing
}

export interface Ray {
    origin: Vec3;
    direction: Vec3;
}

function toGlVec3(v: Vec3): vec3 {
    return vec3.fromValues(v.x, v.y, v.z);
}

function fromGlVec3(v: vec3): Vec3 {
    return { x: v[0], y: v[1], z: v[2] };
}

export class Gizmo {
    private position: Vec3 = { x: 0, y: 0, z: 0 };
    private rotation: Vec3 = { x: 0, y: 0, z: 0 }; // Euler angles in degrees
    private scale: number = 1.0;

    // Constants for gizmo size
    private readonly axisLength = 10.0;
    private readonly arrowLength = 2.0;
    private readonly arrowRadius = 0.5;
    private readonly ringRadius = 10.0;
    private readonly tubeRadius = 0.2;

    setPosition(pos: Vec3) {
        this.position = { ...pos };
    }

    setRotation(rot: Vec3) {
        this.rotation = { ...rot };
    }

    setScale(s: number) {
        this.scale = s;
    }

    private getRotationMatrix(): mat4 {
        const mat = mat4.create();
        // Convert Euler degrees to rads and rotate
        // Quake/Euler conventions can vary. Assuming Z-up right handed?
        // Or generic XYZ euler.
        mat4.rotateZ(mat, mat, this.rotation.z * Math.PI / 180);
        mat4.rotateY(mat, mat, this.rotation.y * Math.PI / 180);
        mat4.rotateX(mat, mat, this.rotation.x * Math.PI / 180);
        return mat;
    }

    draw(renderer: DebugRenderer, activePart: GizmoPart = GizmoPart.None) {
        const origin = this.position;
        const len = this.axisLength * this.scale;
        const arrowLen = this.arrowLength * this.scale;
        const arrowRad = this.arrowRadius * this.scale;
        const ringRad = this.ringRadius * this.scale;
        const tubeRad = this.tubeRadius * this.scale;

        // Colors
        const red: Color = activePart === GizmoPart.XAxis ? { r: 1, g: 0.5, b: 0.5 } : { r: 1, g: 0, b: 0 };
        const green: Color = activePart === GizmoPart.YAxis ? { r: 0.5, g: 1, b: 0.5 } : { r: 0, g: 1, b: 0 };
        const blue: Color = activePart === GizmoPart.ZAxis ? { r: 0.5, g: 0.5, b: 1 } : { r: 0, g: 0, b: 1 };

        const redRing: Color = activePart === GizmoPart.XRing ? { r: 1, g: 0.5, b: 0.5 } : { r: 1, g: 0, b: 0 };
        const greenRing: Color = activePart === GizmoPart.YRing ? { r: 0.5, g: 1, b: 0.5 } : { r: 0, g: 1, b: 0 };
        const blueRing: Color = activePart === GizmoPart.ZRing ? { r: 0.5, g: 0.5, b: 1 } : { r: 0, g: 0, b: 1 };

        // Rotation Matrix
        const rotMat = this.getRotationMatrix();
        const transformPoint = (localPt: vec3): Vec3 => {
            const transformed = vec3.create();
            vec3.transformMat4(transformed, localPt, rotMat);
            return {
                x: origin.x + transformed[0],
                y: origin.y + transformed[1],
                z: origin.z + transformed[2]
            };
        };

        const transformDir = (localDir: vec3): Vec3 => {
             const transformed = vec3.create();
             vec3.transformMat4(transformed, localDir, rotMat); // Rotation only for direction if mat is pure rotation
             return { x: transformed[0], y: transformed[1], z: transformed[2] };
        };

        // X Axis
        const xStart = transformPoint(vec3.fromValues(0,0,0));
        const xEnd = transformPoint(vec3.fromValues(len, 0, 0));
        const xConeBase = transformPoint(vec3.fromValues(len - arrowLen, 0, 0));

        renderer.drawLine(xStart, xEnd, red);
        renderer.addCone(xEnd, xConeBase, arrowRad, red);

        // Y Axis
        const yStart = transformPoint(vec3.fromValues(0,0,0));
        const yEnd = transformPoint(vec3.fromValues(0, len, 0));
        const yConeBase = transformPoint(vec3.fromValues(0, len - arrowLen, 0));

        renderer.drawLine(yStart, yEnd, green);
        renderer.addCone(yEnd, yConeBase, arrowRad, green);

        // Z Axis
        const zStart = transformPoint(vec3.fromValues(0,0,0));
        const zEnd = transformPoint(vec3.fromValues(0, 0, len));
        const zConeBase = transformPoint(vec3.fromValues(0, 0, len - arrowLen));

        renderer.drawLine(zStart, zEnd, blue);
        renderer.addCone(zEnd, zConeBase, arrowRad, blue);

        // Rings
        // For rings, we pass center and axis.
        // The center is origin.
        // The axis needs to be rotated.

        const xAxisVec = transformDir(vec3.fromValues(1,0,0));
        const yAxisVec = transformDir(vec3.fromValues(0,1,0));
        const zAxisVec = transformDir(vec3.fromValues(0,0,1));

        // X-Ring: In YZ plane (Axis = X)
        renderer.addTorus(origin, ringRad, tubeRad, redRing, xAxisVec);

        // Y-Ring: In XZ plane (Axis = Y)
        renderer.addTorus(origin, ringRad, tubeRad, greenRing, yAxisVec);

        // Z-Ring: In XY plane (Axis = Z)
        renderer.addTorus(origin, ringRad, tubeRad, blueRing, zAxisVec);
    }

    intersect(ray: Ray): GizmoPart | null {
        let bestPart: GizmoPart | null = null;
        let bestDist = Infinity;

        // Transform ray to local space
        // P_local = R^-1 * (P_world - Origin)
        // Dir_local = R^-1 * Dir_world

        const rayOriginWorld = toGlVec3(ray.origin);
        const rayDirWorld = toGlVec3(ray.direction);
        const gizmoOrigin = toGlVec3(this.position);

        const rotMat = this.getRotationMatrix();
        const invRotMat = mat4.create();
        mat4.invert(invRotMat, rotMat);

        const rayOriginLocal = vec3.create();
        vec3.subtract(rayOriginLocal, rayOriginWorld, gizmoOrigin);
        vec3.transformMat4(rayOriginLocal, rayOriginLocal, invRotMat);

        const rayDirLocal = vec3.create();
        vec3.transformMat4(rayDirLocal, rayDirWorld, invRotMat); // Assumes pure rotation matrix (orthogonal)
        // Note: transformMat4 includes translation if present in matrix, but invRotMat is pure rotation inverse.
        // Wait, 3x3 part rotates vector.
        // If invRotMat is 4x4, transformMat4 applies translation column. But rotMat only had rotation.
        // So invRotMat only has rotation.
        // However, direction vectors should have w=0. transformMat4 treats as point (w=1).
        // Correct way for direction: only rotate.
        // Since it's rotation matrix around 0,0,0, transformMat4 works for points.
        // For vectors, we should ensure translation is zero or use vector transform.
        // Actually, just using mat4 logic: v' = M * v.
        // If M is rotation, then it's fine.

        // For safety, let's zero out translation in invRotMat if any, but `invert` of pure rotation is transpose.
        // Let's assume correct direction transform.

        vec3.normalize(rayDirLocal, rayDirLocal);

        const len = this.axisLength * this.scale;
        const arrowRad = this.arrowRadius * this.scale;

        // Working in local space (Gizmo is axis aligned at 0,0,0)
        const origin = vec3.fromValues(0,0,0);

        const checkAxis = (axisDir: vec3, length: number, radius: number, part: GizmoPart) => {
             const X = vec3.create(); vec3.subtract(X, rayOriginLocal, origin);
             const dotDV = vec3.dot(rayDirLocal, axisDir);
             const dotXV = vec3.dot(X, axisDir);

             const A = vec3.create();
             vec3.scaleAndAdd(A, rayDirLocal, axisDir, -dotDV);

             const B = vec3.create();
             vec3.scaleAndAdd(B, X, axisDir, -dotXV);

             const aa = vec3.dot(A, A);
             const bb = 2 * vec3.dot(A, B);
             const cc = vec3.dot(B, B) - radius * radius;

             const delta = bb*bb - 4*aa*cc;

             if (delta >= 0) {
                 const t1 = (-bb - Math.sqrt(delta)) / (2*aa);
                 const t2 = (-bb + Math.sqrt(delta)) / (2*aa);

                 const checkHit = (t: number) => {
                     if (t > 0) {
                        const hitPoint = vec3.create();
                        vec3.scaleAndAdd(hitPoint, X, rayDirLocal, t);
                        const heightProj = vec3.dot(hitPoint, axisDir);
                        if (heightProj >= 0 && heightProj <= length) {
                            if (t < bestDist) {
                                bestDist = t;
                                bestPart = part;
                            }
                        }
                     }
                 };
                 checkHit(t1);
                 checkHit(t2);
             }
        };

        const axisX = vec3.fromValues(1, 0, 0);
        const axisY = vec3.fromValues(0, 1, 0);
        const axisZ = vec3.fromValues(0, 0, 1);

        checkAxis(axisX, len, arrowRad, GizmoPart.XAxis);
        checkAxis(axisY, len, arrowRad, GizmoPart.YAxis);
        checkAxis(axisZ, len, arrowRad, GizmoPart.ZAxis);

        const checkRing = (normal: vec3, part: GizmoPart) => {
            const X = vec3.create(); vec3.subtract(X, rayOriginLocal, origin);
            const denom = vec3.dot(rayDirLocal, normal);

            if (Math.abs(denom) > 0.0001) {
                const t = -vec3.dot(X, normal) / denom;
                if (t > 0 && t < bestDist) {
                    const hit = vec3.create();
                    vec3.scaleAndAdd(hit, X, rayDirLocal, t);
                    const dist = vec3.length(hit);
                    const ringR = this.ringRadius * this.scale;
                    const tubeR = this.tubeRadius * this.scale * 4;

                    if (Math.abs(dist - ringR) <= tubeR) {
                        bestDist = t;
                        bestPart = part;
                    }
                }
            }
        };

        checkRing(axisZ, GizmoPart.ZRing); // ZRing is in XY plane, Normal = Z
        checkRing(axisX, GizmoPart.XRing); // XRing is in YZ plane, Normal = X
        checkRing(axisY, GizmoPart.YRing); // YRing is in XZ plane, Normal = Y

        return bestPart;
    }
}
