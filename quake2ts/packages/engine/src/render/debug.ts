import { Mat4, Vec3 } from '@quake2ts/shared';
import { VertexArray, VertexBuffer } from './resources.js';
import { ShaderProgram } from './shaderProgram.js';
import { vec4, vec3, mat4 } from 'gl-matrix';

// Simple shader for debug lines
const VS_SOURCE = `
attribute vec3 a_position;
attribute vec3 a_color;
uniform mat4 u_viewProjection;
varying vec3 v_color;

void main() {
  gl_Position = u_viewProjection * vec4(a_position, 1.0);
  v_color = a_color;
}
`;

const FS_SOURCE = `
precision mediump float;
varying vec3 v_color;

void main() {
  gl_FragColor = vec4(v_color, 1.0);
}
`;

// Shader for solid geometry with optional lighting
const VS_SOLID = `
attribute vec3 a_position;
attribute vec3 a_color;
attribute vec3 a_normal;

uniform mat4 u_viewProjection;
uniform bool u_lightingEnabled;

varying vec3 v_color;
varying vec3 v_normal;

void main() {
  gl_Position = u_viewProjection * vec4(a_position, 1.0);
  v_color = a_color;
  v_normal = a_normal;
}
`;

const FS_SOLID = `
precision mediump float;
varying vec3 v_color;
varying vec3 v_normal;

uniform bool u_lightingEnabled;

void main() {
  vec3 color = v_color;

  if (u_lightingEnabled) {
      // Simple directional light from top-left
      vec3 lightDir = normalize(vec3(0.5, 0.7, 1.0));
      float diff = max(dot(v_normal, lightDir), 0.3); // 0.3 ambient
      color = color * diff;
  }

  gl_FragColor = vec4(color, 1.0);
}
`;

export interface Color {
    r: number;
    g: number;
    b: number;
}

interface TextLabel {
    text: string;
    position: Vec3;
}

function toGlVec3(v: Vec3): vec3 {
    return vec3.fromValues(v.x, v.y, v.z);
}

function fromGlVec3(v: vec3): Vec3 {
    return { x: v[0], y: v[1], z: v[2] };
}

export class DebugRenderer {
    private gl: WebGL2RenderingContext;
    private shader: ShaderProgram;
    private vao: VertexArray;
    private vbo: VertexBuffer;

    private shaderSolid: ShaderProgram;
    private vaoSolid: VertexArray;
    private vboSolid: VertexBuffer;

    private vertices: number[] = [];
    private solidVertices: number[] = [];
    private labels: TextLabel[] = [];

    constructor(gl: WebGL2RenderingContext) {
        this.gl = gl;

        // Lines setup
        this.shader = ShaderProgram.create(gl, { vertex: VS_SOURCE, fragment: FS_SOURCE });
        this.vao = new VertexArray(gl);
        this.vbo = new VertexBuffer(gl, gl.DYNAMIC_DRAW);

        this.vao.configureAttributes([
            { index: 0, size: 3, type: gl.FLOAT, stride: 24, offset: 0 }, // position
            { index: 1, size: 3, type: gl.FLOAT, stride: 24, offset: 12 } // color
        ], this.vbo);

        // Solid setup
        this.shaderSolid = ShaderProgram.create(gl, { vertex: VS_SOLID, fragment: FS_SOLID });
        this.vaoSolid = new VertexArray(gl);
        this.vboSolid = new VertexBuffer(gl, gl.DYNAMIC_DRAW);

        // Solid attributes: position (3), color (3), normal (3) -> stride 9*4 = 36
        this.vaoSolid.configureAttributes([
            { index: 0, size: 3, type: gl.FLOAT, stride: 36, offset: 0 }, // position
            { index: 1, size: 3, type: gl.FLOAT, stride: 36, offset: 12 }, // color
            { index: 2, size: 3, type: gl.FLOAT, stride: 36, offset: 24 }  // normal
        ], this.vboSolid);
    }

    get shaderSize(): number {
        return this.shader.sourceSize + this.shaderSolid.sourceSize;
    }

    drawLine(start: Vec3, end: Vec3, color: Color) {
        this.vertices.push(
            start.x, start.y, start.z, color.r, color.g, color.b,
            end.x, end.y, end.z, color.r, color.g, color.b
        );
    }

    drawBoundingBox(mins: Vec3, maxs: Vec3, color: Color) {
        const { x: x1, y: y1, z: z1 } = mins;
        const { x: x2, y: y2, z: z2 } = maxs;

        // Bottom
        this.drawLine({ x: x1, y: y1, z: z1 }, { x: x2, y: y1, z: z1 }, color);
        this.drawLine({ x: x2, y: y1, z: z1 }, { x: x2, y: y2, z: z1 }, color);
        this.drawLine({ x: x2, y: y2, z: z1 }, { x: x1, y: y2, z: z1 }, color);
        this.drawLine({ x: x1, y: y2, z: z1 }, { x: x1, y: y1, z: z1 }, color);

        // Top
        this.drawLine({ x: x1, y: y1, z: z2 }, { x: x2, y: y1, z: z2 }, color);
        this.drawLine({ x: x2, y: y1, z: z2 }, { x: x2, y: y2, z: z2 }, color);
        this.drawLine({ x: x2, y: y2, z: z2 }, { x: x1, y: y2, z: z2 }, color);
        this.drawLine({ x: x1, y: y2, z: z2 }, { x: x1, y: y1, z: z2 }, color);

        // Pillars
        this.drawLine({ x: x1, y: y1, z: z1 }, { x: x1, y: y1, z: z2 }, color);
        this.drawLine({ x: x2, y: y1, z: z1 }, { x: x2, y: y1, z: z2 }, color);
        this.drawLine({ x: x2, y: y2, z: z1 }, { x: x2, y: y2, z: z2 }, color);
        this.drawLine({ x: x1, y: y2, z: z1 }, { x: x1, y: y2, z: z2 }, color);
    }

    drawPoint(position: Vec3, size: number, color: Color) {
        const s = size / 2;
        this.drawBoundingBox(
            { x: position.x - s, y: position.y - s, z: position.z - s },
            { x: position.x + s, y: position.y + s, z: position.z + s },
            color
        );
    }

    drawAxes(position: Vec3, size: number) {
        this.drawLine(position, { x: position.x + size, y: position.y, z: position.z }, { r: 1, g: 0, b: 0 }); // X - Red
        this.drawLine(position, { x: position.x, y: position.y + size, z: position.z }, { r: 0, g: 1, b: 0 }); // Y - Green
        this.drawLine(position, { x: position.x, y: position.y, z: position.z + size }, { r: 0, g: 0, b: 1 }); // Z - Blue
    }

    drawText3D(text: string, position: Vec3) {
        this.labels.push({ text, position });
    }

    private addTriangle(v1: Vec3, v2: Vec3, v3: Vec3, normal: Vec3, color: Color) {
        // v1
        this.solidVertices.push(v1.x, v1.y, v1.z);
        this.solidVertices.push(color.r, color.g, color.b);
        this.solidVertices.push(normal.x, normal.y, normal.z);
        // v2
        this.solidVertices.push(v2.x, v2.y, v2.z);
        this.solidVertices.push(color.r, color.g, color.b);
        this.solidVertices.push(normal.x, normal.y, normal.z);
        // v3
        this.solidVertices.push(v3.x, v3.y, v3.z);
        this.solidVertices.push(color.r, color.g, color.b);
        this.solidVertices.push(normal.x, normal.y, normal.z);
    }

    addCone(apex: Vec3, baseCenter: Vec3, baseRadius: number, color: Color) {
        const segments = 16;

        // Calculate axis and basis vectors using gl-matrix
        const apexGl = toGlVec3(apex);
        const baseCenterGl = toGlVec3(baseCenter);

        const axis = vec3.create();
        vec3.subtract(axis, apexGl, baseCenterGl);

        // const height = vec3.length(axis);
        vec3.normalize(axis, axis);

        // Arbitrary up vector to find right vector
        let up = vec3.fromValues(0, 0, 1);
        if (Math.abs(vec3.dot(axis, up)) > 0.99) {
            up = vec3.fromValues(0, 1, 0);
        }

        const right = vec3.create();
        vec3.cross(right, up, axis);
        vec3.normalize(right, right);

        const forward = vec3.create();
        vec3.cross(forward, axis, right);

        // Generate base vertices
        const basePoints: vec3[] = [];
        for (let i = 0; i < segments; i++) {
            const angle = (i / segments) * Math.PI * 2;
            const x = Math.cos(angle) * baseRadius;
            const y = Math.sin(angle) * baseRadius;

            // point = baseCenter + right * x + forward * y
            const point = vec3.clone(baseCenterGl);
            vec3.scaleAndAdd(point, point, right, x);
            vec3.scaleAndAdd(point, point, forward, y);

            basePoints.push(point);
        }

        // Base disk
        const baseNormal = vec3.clone(axis);
        vec3.scale(baseNormal, baseNormal, -1); // Pointing away from cone
        const baseNormalVec3 = fromGlVec3(baseNormal);

        const center = baseCenter; // Vec3

        for (let i = 0; i < segments; i++) {
            const p1 = fromGlVec3(basePoints[i]);
            const p2 = fromGlVec3(basePoints[(i + 1) % segments]);

            // Triangle fan for base
            this.addTriangle(center, p2, p1, baseNormalVec3, color);
        }

        // Sides
        for (let i = 0; i < segments; i++) {
            const p1Gl = basePoints[i];
            const p2Gl = basePoints[(i + 1) % segments];

            const p1 = fromGlVec3(p1Gl);
            const p2 = fromGlVec3(p2Gl);

            // Compute face normal
            const v1 = vec3.create();
            vec3.subtract(v1, p2Gl, p1Gl);
            const v2 = vec3.create();
            vec3.subtract(v2, apexGl, p1Gl);
            const normal = vec3.create();
            vec3.cross(normal, v1, v2);
            vec3.normalize(normal, normal);
            const normalVec3 = fromGlVec3(normal);

            this.addTriangle(p1, p2, apex, normalVec3, color);
        }
    }

    addTorus(center: Vec3, radius: number, tubeRadius: number, color: Color, axis: Vec3 = {x: 0, y: 0, z: 1}) {
        const segments = 16;
        const tubeSegments = 8;

        // Compute orientation basis from axis
        const axisVec = toGlVec3(axis);
        vec3.normalize(axisVec, axisVec);

        const centerGl = toGlVec3(center);

        // Default Z axis
        const zAxis = vec3.fromValues(0, 0, 1);

        // Compute rotation matrix to align Z with axisVec
        const rotation = mat4.create();

        // If axis is parallel to Z, special case
        if (Math.abs(vec3.dot(axisVec, zAxis)) > 0.999) {
             if (axisVec[2] < 0) {
                 mat4.rotateX(rotation, rotation, Math.PI); // Flip 180 if -Z
             }
             // else identity
        } else {
             const rotAxis = vec3.create();
             vec3.cross(rotAxis, zAxis, axisVec);
             vec3.normalize(rotAxis, rotAxis);
             const angle = Math.acos(vec3.dot(zAxis, axisVec));
             mat4.fromRotation(rotation, angle, rotAxis);
        }

        const vertices: vec3[][] = [];
        const normals: vec3[][] = [];

        for (let i = 0; i <= segments; i++) {
            const u = (i / segments) * Math.PI * 2;
            const cosU = Math.cos(u);
            const sinU = Math.sin(u);

            const ringVerts: vec3[] = [];
            const ringNorms: vec3[] = [];

            for (let j = 0; j <= tubeSegments; j++) {
                const v = (j / tubeSegments) * Math.PI * 2;
                const cosV = Math.cos(v);
                const sinV = Math.sin(v);

                // Local coords (Z-up)
                const cx = (radius + tubeRadius * cosV) * cosU;
                const cy = (radius + tubeRadius * cosV) * sinU;
                const cz = tubeRadius * sinV;

                const pt = vec3.fromValues(cx, cy, cz);

                // Normal
                const nx = cosV * cosU;
                const ny = cosV * sinU;
                const nz = sinV;
                const n = vec3.fromValues(nx, ny, nz);

                // Transform
                vec3.transformMat4(pt, pt, rotation);
                vec3.transformMat4(n, n, rotation);

                vec3.add(pt, pt, centerGl); // Translate to center

                ringVerts.push(pt);
                ringNorms.push(n);
            }
            vertices.push(ringVerts);
            normals.push(ringNorms);
        }

        for (let i = 0; i < segments; i++) {
            for (let j = 0; j < tubeSegments; j++) {
                const p1 = vertices[i][j];
                const p2 = vertices[i + 1][j];
                const p3 = vertices[i + 1][j + 1];
                const p4 = vertices[i][j + 1];

                const p1V = fromGlVec3(p1);
                const p2V = fromGlVec3(p2);
                const p3V = fromGlVec3(p3);
                const p4V = fromGlVec3(p4);

                // Let's use computed face normal for better flat shading look
                const v1 = vec3.create(); vec3.subtract(v1, p2, p1);
                const v2 = vec3.create(); vec3.subtract(v2, p3, p1);
                const faceN1 = vec3.create();
                vec3.cross(faceN1, v1, v2);
                vec3.normalize(faceN1, faceN1);

                this.addTriangle(p1V, p2V, p3V, fromGlVec3(faceN1), color);

                const v3 = vec3.create(); vec3.subtract(v3, p3, p1);
                const v4 = vec3.create(); vec3.subtract(v4, p4, p1);
                const faceN2 = vec3.create();
                vec3.cross(faceN2, v3, v4);
                vec3.normalize(faceN2, faceN2);

                this.addTriangle(p1V, p3V, p4V, fromGlVec3(faceN2), color);
            }
        }
    }

    // Updated render method
    render(viewProjection: Float32Array, alwaysOnTop: boolean = false) {
        if (alwaysOnTop) {
            this.gl.disable(this.gl.DEPTH_TEST);
        }

        // 1. Draw Lines
        if (this.vertices.length > 0) {
            this.shader.use();
            const loc = this.shader.getUniformLocation('u_viewProjection');
            if (loc) {
                this.gl.uniformMatrix4fv(loc, false, viewProjection);
            }

            this.vbo.upload(new Float32Array(this.vertices));
            this.vao.bind();

            this.gl.drawArrays(this.gl.LINES, 0, this.vertices.length / 6);
        }

        // 2. Draw Solids
        if (this.solidVertices.length > 0) {
            this.shaderSolid.use();
            const loc = this.shaderSolid.getUniformLocation('u_viewProjection');
            if (loc) {
                this.gl.uniformMatrix4fv(loc, false, viewProjection);
            }

            const locLight = this.shaderSolid.getUniformLocation('u_lightingEnabled');
            if (locLight) {
                this.gl.uniform1i(locLight, 1); // Enable lighting
            }

            this.vboSolid.upload(new Float32Array(this.solidVertices));
            this.vaoSolid.bind();

            this.gl.drawArrays(this.gl.TRIANGLES, 0, this.solidVertices.length / 9);
        }

        if (alwaysOnTop) {
            this.gl.enable(this.gl.DEPTH_TEST);
        }
    }

    // New method to retrieve 2D projected labels for external rendering (e.g. by Renderer using drawString)
    // Returns list of { text, x, y } where x,y are canvas coords
    getLabels(viewProjection: Float32Array, width: number, height: number): { text: string, x: number, y: number }[] {
         const results: { text: string, x: number, y: number }[] = [];

         for (const label of this.labels) {
             const v = vec4.fromValues(label.position.x, label.position.y, label.position.z, 1.0);
             const clip = vec4.create();
             // Assuming viewProjection is compatible with gl-matrix vec4.transformMat4
             // But viewProjection here is Float32Array (16 elements).
             // We can map it.
             const vp = viewProjection as unknown as [number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number];

             // Manually transform or use gl-matrix
             // transformMat4(out, a, m)
             // m is mat4
             const m = vp;
             const x = v[0], y = v[1], z = v[2], w = v[3];
             clip[0] = m[0] * x + m[4] * y + m[8] * z + m[12] * w;
             clip[1] = m[1] * x + m[5] * y + m[9] * z + m[13] * w;
             clip[2] = m[2] * x + m[6] * y + m[10] * z + m[14] * w;
             clip[3] = m[3] * x + m[7] * y + m[11] * z + m[15] * w;

             if (clip[3] > 0) { // In front of camera
                 const ndcX = clip[0] / clip[3];
                 const ndcY = clip[1] / clip[3];

                 // Map NDC to viewport
                 // x: [-1, 1] -> [0, width]
                 // y: [-1, 1] -> [height, 0] (since canvas y is down, but GL y is up. Wait, GL NDC y is up, Canvas y is down.)

                 const screenX = (ndcX + 1) * 0.5 * width;
                 const screenY = (1 - ndcY) * 0.5 * height; // Flip Y

                 // Simple bounds check?
                 if (screenX >= 0 && screenX <= width && screenY >= 0 && screenY <= height) {
                     results.push({ text: label.text, x: screenX, y: screenY });
                 }
             }
         }
         return results;
    }

    clear() {
        this.vertices = [];
        this.solidVertices = [];
        this.labels = [];
    }
}
