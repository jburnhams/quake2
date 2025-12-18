
import { ShaderProgram } from './shaderProgram.js';
import { VertexArray, VertexBuffer } from './resources.js';

export const LINE_VERTEX_SHADER = `#version 300 es
precision highp float;

layout(location = 0) in vec3 a_position;
layout(location = 1) in vec4 a_color;

uniform mat4 u_viewProjection;

out vec4 v_color;

void main() {
  v_color = a_color;
  gl_Position = u_viewProjection * vec4(a_position, 1.0);
}`;

export const LINE_FRAGMENT_SHADER = `#version 300 es
precision highp float;

in vec4 v_color;
out vec4 o_color;

void main() {
  o_color = v_color;
}`;

export interface LineVertex {
    x: number;
    y: number;
    z: number;
    r: number;
    g: number;
    b: number;
    a: number;
}

export class CollisionVisRenderer {
    readonly gl: WebGL2RenderingContext;
    readonly program: ShaderProgram;
    readonly vao: VertexArray;
    readonly vbo: VertexBuffer;

    private vertices: number[] = [];
    private readonly uniformViewProjection: WebGLUniformLocation | null;

    constructor(gl: WebGL2RenderingContext) {
        this.gl = gl;
        this.program = ShaderProgram.create(
            gl,
            { vertex: LINE_VERTEX_SHADER, fragment: LINE_FRAGMENT_SHADER },
            { a_position: 0, a_color: 1 }
        );

        this.uniformViewProjection = this.program.getUniformLocation('u_viewProjection');

        this.vao = new VertexArray(gl);
        this.vbo = new VertexBuffer(gl, gl.STREAM_DRAW);

        // 3 floats position, 4 floats color = 7 floats * 4 bytes = 28 stride
        this.vao.configureAttributes(
            [
                { index: 0, size: 3, type: gl.FLOAT, stride: 28, offset: 0 },
                { index: 1, size: 4, type: gl.FLOAT, stride: 28, offset: 12 },
            ],
            this.vbo
        );
    }

    get shaderSize(): number {
        return this.program.sourceSize;
    }

    addLine(start: {x:number, y:number, z:number}, end: {x:number, y:number, z:number}, color: {r:number, g:number, b:number, a:number} = {r:1, g:0, b:0, a:1}) {
        this.vertices.push(
            start.x, start.y, start.z, color.r, color.g, color.b, color.a,
            end.x, end.y, end.z, color.r, color.g, color.b, color.a
        );
    }

    addBBox(mins: {x:number, y:number, z:number}, maxs: {x:number, y:number, z:number}, color: {r:number, g:number, b:number, a:number} = {r:0, g:1, b:0, a:1}) {
        const p0 = { x: mins.x, y: mins.y, z: mins.z };
        const p1 = { x: maxs.x, y: mins.y, z: mins.z };
        const p2 = { x: maxs.x, y: maxs.y, z: mins.z };
        const p3 = { x: mins.x, y: maxs.y, z: mins.z };
        const p4 = { x: mins.x, y: mins.y, z: maxs.z };
        const p5 = { x: maxs.x, y: mins.y, z: maxs.z };
        const p6 = { x: maxs.x, y: maxs.y, z: maxs.z };
        const p7 = { x: mins.x, y: maxs.y, z: maxs.z };

        // Bottom face
        this.addLine(p0, p1, color);
        this.addLine(p1, p2, color);
        this.addLine(p2, p3, color);
        this.addLine(p3, p0, color);

        // Top face
        this.addLine(p4, p5, color);
        this.addLine(p5, p6, color);
        this.addLine(p6, p7, color);
        this.addLine(p7, p4, color);

        // Vertical edges
        this.addLine(p0, p4, color);
        this.addLine(p1, p5, color);
        this.addLine(p2, p6, color);
        this.addLine(p3, p7, color);
    }

    clear() {
        this.vertices = [];
    }

    render(viewProjection: Float32List) {
        if (this.vertices.length === 0) return;

        this.program.use();
        this.gl.uniformMatrix4fv(this.uniformViewProjection, false, viewProjection);

        this.vbo.upload(new Float32Array(this.vertices), this.gl.STREAM_DRAW);
        this.vao.bind();

        this.gl.drawArrays(this.gl.LINES, 0, this.vertices.length / 7);
    }
}
