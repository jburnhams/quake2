struct VertexOutput {
    @builtin(position) position: vec4f,
    @location(0) texCoord: vec2f,
};

@vertex
fn vertexMain(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
    var pos = array<vec2f, 4>(
        vec2f(-1.0, -1.0),
        vec2f( 1.0, -1.0),
        vec2f(-1.0,  1.0),
        vec2f( 1.0,  1.0)
    );

    var output: VertexOutput;
    output.position = vec4f(pos[vertexIndex], 0.0, 1.0);
    // Standard UV: (0,0) at top-left.
    // Clip space (-1, -1) is bottom-left.
    // We want (-1, -1) -> (0, 1) to map bottom of screen to bottom of texture (if texture is right-side up).
    // Let's assume texture is standard orientation (0,0 top-left).
    // pos.y = -1 -> 1.0
    // pos.y = 1 -> 0.0
    output.texCoord = vec2f(
        pos[vertexIndex].x * 0.5 + 0.5,
        1.0 - (pos[vertexIndex].y * 0.5 + 0.5)
    );
    return output;
}

struct PostProcessUniforms {
    time: f32,
    strength: f32,
    gamma: f32,
    brightness: f32,
};

@group(0) @binding(0) var uTexture: texture_2d<f32>;
@group(0) @binding(1) var uSampler: sampler;
@group(0) @binding(2) var<uniform> uniforms: PostProcessUniforms;

@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4f {
    var uv = input.texCoord;

    // Underwater distortion
    if (uniforms.strength > 0.0) {
        let xOffset = sin(uv.y * 10.0 + uniforms.time * 2.0) * 0.01 * uniforms.strength;
        let yOffset = cos(uv.x * 10.0 + uniforms.time * 2.0) * 0.01 * uniforms.strength;
        uv += vec2f(xOffset, yOffset);
        uv = clamp(uv, vec2f(0.001), vec2f(0.999));
    }

    var color = textureSample(uTexture, uSampler, uv);

    // Brightness
    color = vec4f(color.rgb * uniforms.brightness, color.a);

    // Gamma
    if (uniforms.gamma != 1.0) {
        // Avoid negative/zero base for pow
        color = vec4f(pow(abs(color.rgb), vec3f(1.0 / uniforms.gamma)), color.a);
    }

    return color;
}
