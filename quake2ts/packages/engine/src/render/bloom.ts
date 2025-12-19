import { ShaderProgram } from './shaderProgram.js';
import { Framebuffer, Texture2D } from './resources.js';

const QUAD_VERTEX_SOURCE = `#version 300 es
layout(location = 0) in vec2 a_position;

out vec2 v_texCoord;

void main() {
    v_texCoord = a_position * 0.5 + 0.5;
    gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

const EXTRACT_FRAGMENT_SOURCE = `#version 300 es
precision mediump float;

in vec2 v_texCoord;
uniform sampler2D u_texture;
uniform float u_threshold;

out vec4 o_color;

void main() {
    vec4 color = texture(u_texture, v_texCoord);
    float brightness = dot(color.rgb, vec3(0.2126, 0.7152, 0.0722));
    if (brightness > u_threshold) {
        o_color = vec4(color.rgb, 1.0);
    } else {
        o_color = vec4(0.0, 0.0, 0.0, 1.0);
    }
}
`;

const BLUR_FRAGMENT_SOURCE = `#version 300 es
precision mediump float;

in vec2 v_texCoord;
uniform sampler2D u_texture;
uniform bool u_horizontal;
uniform float u_weight[5];

out vec4 o_color;

void main() {
    vec2 tex_offset = 1.0 / vec2(textureSize(u_texture, 0)); // gets size of single texel
    vec3 result = texture(u_texture, v_texCoord).rgb * u_weight[0];

    if (u_horizontal) {
        for(int i = 1; i < 5; ++i) {
            result += texture(u_texture, v_texCoord + vec2(tex_offset.x * float(i), 0.0)).rgb * u_weight[i];
            result += texture(u_texture, v_texCoord - vec2(tex_offset.x * float(i), 0.0)).rgb * u_weight[i];
        }
    } else {
        for(int i = 1; i < 5; ++i) {
            result += texture(u_texture, v_texCoord + vec2(0.0, tex_offset.y * float(i))).rgb * u_weight[i];
            result += texture(u_texture, v_texCoord - vec2(0.0, tex_offset.y * float(i))).rgb * u_weight[i];
        }
    }
    o_color = vec4(result, 1.0);
}
`;

// Simple additive blend shader for final composite to screen
const COMPOSITE_FRAGMENT_SOURCE = `#version 300 es
precision mediump float;

in vec2 v_texCoord;
uniform sampler2D u_texture;
uniform float u_intensity;

out vec4 o_color;

void main() {
    vec4 color = texture(u_texture, v_texCoord);
    o_color = vec4(color.rgb * u_intensity, 1.0);
}
`;


export class BloomPipeline {
    readonly gl: WebGL2RenderingContext;
    private extractProgram: ShaderProgram;
    private blurProgram: ShaderProgram;
    private compositeProgram: ShaderProgram;
    private vao: WebGLVertexArrayObject | null;

    private framebuffer1: Framebuffer;
    private framebuffer2: Framebuffer;
    private texture1: Texture2D;
    private texture2: Texture2D;

    private width = 0;
    private height = 0;

    constructor(gl: WebGL2RenderingContext) {
        this.gl = gl;
        this.extractProgram = ShaderProgram.create(gl, { vertex: QUAD_VERTEX_SOURCE, fragment: EXTRACT_FRAGMENT_SOURCE }, { a_position: 0 });
        this.blurProgram = ShaderProgram.create(gl, { vertex: QUAD_VERTEX_SOURCE, fragment: BLUR_FRAGMENT_SOURCE }, { a_position: 0 });
        this.compositeProgram = ShaderProgram.create(gl, { vertex: QUAD_VERTEX_SOURCE, fragment: COMPOSITE_FRAGMENT_SOURCE }, { a_position: 0 });

        this.framebuffer1 = new Framebuffer(gl);
        this.framebuffer2 = new Framebuffer(gl);
        this.texture1 = new Texture2D(gl);
        this.texture2 = new Texture2D(gl);

        this.texture1.setParameters({ minFilter: gl.LINEAR, magFilter: gl.LINEAR, wrapS: gl.CLAMP_TO_EDGE, wrapT: gl.CLAMP_TO_EDGE });
        this.texture2.setParameters({ minFilter: gl.LINEAR, magFilter: gl.LINEAR, wrapS: gl.CLAMP_TO_EDGE, wrapT: gl.CLAMP_TO_EDGE });

        this.vao = gl.createVertexArray();
        gl.bindVertexArray(this.vao);
        const vertices = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);
        const vbo = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
        gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
        gl.bindVertexArray(null);
    }

    resize(width: number, height: number) {
        if (this.width !== width || this.height !== height) {
            this.width = width;
            this.height = height;
            // Downscale by 2 for performance and bloom radius
            const w = Math.floor(width / 2) || 1;
            const h = Math.floor(height / 2) || 1;

            this.texture1.upload(w, h, null);
            this.framebuffer1.attachTexture2D(this.gl.COLOR_ATTACHMENT0, this.texture1);

            this.texture2.upload(w, h, null);
            this.framebuffer2.attachTexture2D(this.gl.COLOR_ATTACHMENT0, this.texture2);
        }
    }

    render(sceneTexture: Texture2D, intensity: number = 0.5) {
        const gl = this.gl;
        const w = Math.floor(this.width / 2) || 1;
        const h = Math.floor(this.height / 2) || 1;

        gl.bindVertexArray(this.vao);

        // 1. Extract Brightness to framebuffer1 (texture1)
        this.framebuffer1.bind();
        gl.viewport(0, 0, w, h);
        gl.clear(gl.COLOR_BUFFER_BIT);

        this.extractProgram.use();
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, sceneTexture.texture);
        gl.uniform1i(this.extractProgram.getUniformLocation('u_texture'), 0);
        gl.uniform1f(this.extractProgram.getUniformLocation('u_threshold'), 0.7); // Configurable?
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

        // 2. Blur (Ping Pong)
        this.blurProgram.use();
        gl.uniform1fv(this.blurProgram.getUniformLocation('u_weight'), [0.227027, 0.1945946, 0.1216216, 0.054054, 0.016216]);
        const locHorizontal = this.blurProgram.getUniformLocation('u_horizontal');
        const locTexture = this.blurProgram.getUniformLocation('u_texture');

        const amount = 4; // Total blur passes (2 round trips)
        let horizontal = true;
        let first_iteration = true;

        for (let i = 0; i < amount; i++) {
            this.framebuffer2.bind(); // Target
            // Source is texture1 initially, then flip flops.
            // Wait, I need ping pong logic.

            // Pass 1: Texture1 -> Horizontal Blur -> Texture2
            // Pass 2: Texture2 -> Vertical Blur -> Texture1

            if (horizontal) {
                this.framebuffer2.bind();
                gl.bindTexture(gl.TEXTURE_2D, this.texture1.texture);
            } else {
                this.framebuffer1.bind();
                gl.bindTexture(gl.TEXTURE_2D, this.texture2.texture);
            }

            gl.uniform1i(locHorizontal, horizontal ? 1 : 0);
            gl.uniform1i(locTexture, 0);
            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

            horizontal = !horizontal;
        }

        // Result is in texture1 (since amount=4, last was vertical blur into framebuffer1/texture1)

        // 3. Composite to screen (Additive)
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, this.width, this.height);

        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ONE, gl.ONE); // Additive blending
        gl.disable(gl.DEPTH_TEST); // Usually safe for post process overlay

        this.compositeProgram.use();
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.texture1.texture);
        gl.uniform1i(this.compositeProgram.getUniformLocation('u_texture'), 0);
        gl.uniform1f(this.compositeProgram.getUniformLocation('u_intensity'), intensity);

        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); // Restore default
        gl.enable(gl.DEPTH_TEST);
        gl.bindVertexArray(null);
    }

    dispose() {
        this.extractProgram.dispose();
        this.blurProgram.dispose();
        this.compositeProgram.dispose();
        this.framebuffer1.dispose();
        this.framebuffer2.dispose();
        this.texture1.dispose();
        this.texture2.dispose();
        this.gl.deleteVertexArray(this.vao);
    }
}
