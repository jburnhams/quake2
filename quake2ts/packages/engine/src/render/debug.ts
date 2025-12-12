import { Mat4, Vec3 } from '@quake2ts/shared';
import { VertexArray, VertexBuffer } from './resources.js';
import { ShaderProgram } from './shaderProgram.js';

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

export class DebugRenderer {
    private gl: WebGL2RenderingContext;
    private shader: ShaderProgram;
    private vao: VertexArray;
    private vbo: VertexBuffer;

    private vertices: number[] = [];

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

    clear() {
        this.vertices = [];
    }
}
