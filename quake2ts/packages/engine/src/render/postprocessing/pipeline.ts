import { ShaderProgram } from '../shaderProgram.js';

const VERTEX_SOURCE = `#version 300 es
layout(location = 0) in vec2 a_position;

out vec2 v_texCoord;

void main() {
    v_texCoord = a_position * 0.5 + 0.5;
    gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

const FRAGMENT_SOURCE = `#version 300 es
precision mediump float;

in vec2 v_texCoord;

uniform sampler2D u_texture;
uniform float u_time;
uniform float u_strength; // Distortion strength

out vec4 o_color;

void main() {
    vec2 uv = v_texCoord;

    // Simple sine wave distortion
    // Corresponds to gl_warp.c TURBSCALE somewhat
    float xOffset = sin(uv.y * 10.0 + u_time * 2.0) * 0.01 * u_strength;
    float yOffset = cos(uv.x * 10.0 + u_time * 2.0) * 0.01 * u_strength;

    uv += vec2(xOffset, yOffset);

    // Clamp UVs to avoid edge artifacts
    uv = clamp(uv, 0.001, 0.999);

    o_color = texture(u_texture, uv);
}
`;

export class PostProcessPipeline {
    readonly gl: WebGL2RenderingContext;
    readonly program: ShaderProgram;
    private vao: WebGLVertexArrayObject | null;

    private readonly uTime: WebGLUniformLocation | null;
    private readonly uStrength: WebGLUniformLocation | null;
    private readonly uTexture: WebGLUniformLocation | null;

    constructor(gl: WebGL2RenderingContext) {
        this.gl = gl;
        this.program = ShaderProgram.create(
            gl,
            { vertex: VERTEX_SOURCE, fragment: FRAGMENT_SOURCE },
            { a_position: 0 }
        );

        this.uTime = this.program.getUniformLocation('u_time');
        this.uStrength = this.program.getUniformLocation('u_strength');
        this.uTexture = this.program.getUniformLocation('u_texture');

        // Create a full-screen quad VAO
        this.vao = gl.createVertexArray();
        gl.bindVertexArray(this.vao);

        const vertices = new Float32Array([
            -1, -1,
             1, -1,
            -1,  1,
             1,  1,
        ]);

        const vbo = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
        gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

        gl.bindVertexArray(null);
    }

    render(texture: WebGLTexture, time: number, strength: number = 1.0) {
        this.program.use();

        this.gl.activeTexture(this.gl.TEXTURE0);
        this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
        this.gl.uniform1i(this.uTexture, 0);

        this.gl.uniform1f(this.uTime, time);
        this.gl.uniform1f(this.uStrength, strength);

        this.gl.bindVertexArray(this.vao);
        this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);
        this.gl.bindVertexArray(null);
    }

    dispose() {
        this.program.dispose();
        this.gl.deleteVertexArray(this.vao);
        // Note: Buffer deletion is skipped for simplicity but should be tracked if robust cleanup is needed
    }
}
