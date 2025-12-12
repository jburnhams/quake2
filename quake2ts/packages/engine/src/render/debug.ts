import { Mat4, Vec3 } from '@quake2ts/shared';
import { VertexArray, VertexBuffer } from './resources.js';
import { ShaderProgram } from './shaderProgram.js';
import { vec4 } from 'gl-matrix';

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

export interface Color {
    r: number;
    g: number;
    b: number;
}

interface TextLabel {
    text: string;
    position: Vec3;
}

export class DebugRenderer {
    private gl: WebGL2RenderingContext;
    private shader: ShaderProgram;
    private vao: VertexArray;
    private vbo: VertexBuffer;

    private vertices: number[] = [];
    private labels: TextLabel[] = [];

    constructor(gl: WebGL2RenderingContext) {
        this.gl = gl;
        this.shader = ShaderProgram.create(gl, { vertex: VS_SOURCE, fragment: FS_SOURCE });
        this.vao = new VertexArray(gl);
        this.vbo = new VertexBuffer(gl, gl.DYNAMIC_DRAW);

        this.vao.configureAttributes([
            { index: 0, size: 3, type: gl.FLOAT, stride: 24, offset: 0 }, // position
            { index: 1, size: 3, type: gl.FLOAT, stride: 24, offset: 12 } // color
        ], this.vbo);
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

    render(viewProjection: Float32Array) {
        if (this.vertices.length === 0) return;

        this.shader.use();
        const loc = this.shader.getUniformLocation('u_viewProjection');
        if (loc) {
            this.gl.uniformMatrix4fv(loc, false, viewProjection);
        }

        this.vbo.upload(new Float32Array(this.vertices));
        this.vao.bind();

        this.gl.drawArrays(this.gl.LINES, 0, this.vertices.length / 6);
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
        this.labels = [];
    }
}
