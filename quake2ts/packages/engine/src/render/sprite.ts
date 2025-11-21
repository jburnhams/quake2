import { ShaderProgram } from './shaderProgram.js';
import { VertexArray, VertexBuffer } from './resources.js';

export const SPRITE_VERTEX_SHADER = `#version 300 es
precision highp float;

layout(location = 0) in vec2 a_position;
layout(location = 1) in vec2 a_texCoord;

uniform mat4 u_projection;

out vec2 v_texCoord;

void main() {
  v_texCoord = a_texCoord;
  gl_Position = u_projection * vec4(a_position, 0.0, 1.0);
}`;

export const SPRITE_FRAGMENT_SHADER = `#version 300 es
precision highp float;

in vec2 v_texCoord;

uniform sampler2D u_diffuseMap;
uniform vec4 u_tint;

out vec4 o_color;

void main() {
  o_color = texture(u_diffuseMap, v_texCoord) * u_tint;
}`;

export class SpriteRenderer {
    readonly gl: WebGL2RenderingContext;
    readonly program: ShaderProgram;
    readonly vao: VertexArray;
    readonly vbo: VertexBuffer;

    private readonly uniformProjection: WebGLUniformLocation | null;
    private readonly uniformDiffuse: WebGLUniformLocation | null;
    private readonly uniformTint: WebGLUniformLocation | null;

    constructor(gl: WebGL2RenderingContext) {
        this.gl = gl;
        this.program = ShaderProgram.create(
            gl,
            { vertex: SPRITE_VERTEX_SHADER, fragment: SPRITE_FRAGMENT_SHADER },
            { a_position: 0, a_texCoord: 1 }
        );

        this.uniformProjection = this.program.getUniformLocation('u_projection');
        this.uniformDiffuse = this.program.getUniformLocation('u_diffuseMap');
        this.uniformTint = this.program.getUniformLocation('u_tint');

        this.vao = new VertexArray(gl);
        this.vbo = new VertexBuffer(gl, gl.STREAM_DRAW);

        this.vao.configureAttributes(
            [
                { index: 0, size: 2, type: gl.FLOAT, stride: 16, offset: 0 },
                { index: 1, size: 2, type: gl.FLOAT, stride: 16, offset: 8 },
            ],
            this.vbo
        );
    }

    begin(projection: Float32List) {
        this.program.use();
        this.gl.uniformMatrix4fv(this.uniformProjection, false, projection);
    }

    draw(x: number, y: number, width: number, height: number, u1 = 0, v1 = 0, u2 = 1, v2 = 1, tint: readonly [number, number, number, number] = [1, 1, 1, 1]) {
        const x1 = x;
        const y1 = y;
        const x2 = x + width;
        const y2 = y + height;

        const data = new Float32Array([
            x1, y1, u1, v1,
            x2, y1, u2, v1,
            x1, y2, u1, v2,
            x2, y2, u2, v2,
        ]);

        this.vbo.upload(data, this.gl.STREAM_DRAW);
        this.gl.uniform4fv(this.uniformTint, new Float32Array(tint));

        this.vao.bind();
        this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);
    }
}
