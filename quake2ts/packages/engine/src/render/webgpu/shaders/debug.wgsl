// Debug rendering shader

struct Uniforms {
    viewProjection: mat4x4<f32>,
}
@group(0) @binding(0) var<uniform> uniforms: Uniforms;

// --- LINE SHADER ---

struct LineVertexInput {
    @location(0) position: vec3<f32>,
    @location(1) color: vec3<f32>,
}

struct LineVertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) color: vec3<f32>,
}

@vertex
fn lineVertexMain(input: LineVertexInput) -> LineVertexOutput {
    var output: LineVertexOutput;
    output.position = uniforms.viewProjection * vec4<f32>(input.position, 1.0);
    output.color = input.color;
    return output;
}

@fragment
fn lineFragmentMain(input: LineVertexOutput) -> @location(0) vec4<f32> {
    return vec4<f32>(input.color, 1.0);
}

// --- SOLID SHADER ---

struct SolidVertexInput {
    @location(0) position: vec3<f32>,
    @location(1) color: vec3<f32>,
    @location(2) normal: vec3<f32>,
}

struct SolidVertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) color: vec3<f32>,
    @location(1) normal: vec3<f32>,
}

@vertex
fn solidVertexMain(input: SolidVertexInput) -> SolidVertexOutput {
    var output: SolidVertexOutput;
    output.position = uniforms.viewProjection * vec4<f32>(input.position, 1.0);
    output.color = input.color;
    output.normal = input.normal;
    return output;
}

@fragment
fn solidFragmentMain(input: SolidVertexOutput) -> @location(0) vec4<f32> {
    // Simple directional lighting
    let lightDir = normalize(vec3<f32>(0.5, 0.7, 1.0));
    let diff = max(dot(input.normal, lightDir), 0.3); // 0.3 ambient
    let litColor = input.color * diff;
    return vec4<f32>(litColor, 1.0);
}
