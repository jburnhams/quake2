// Debug Rendering Shaders
// Supports both line rendering (wireframes, bounding boxes, normals)
// and solid geometry (cones, torus) with optional lighting

// ============================================================================
// Line Rendering (for wireframes, bounds, normals, axes)
// ============================================================================

struct LineVertexInput {
    @location(0) position: vec3<f32>,
    @location(1) color: vec3<f32>,
}

struct LineVertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) color: vec3<f32>,
}

struct ViewProjection {
    viewProjection: mat4x4<f32>,
}

@group(0) @binding(0) var<uniform> uViewProjection: ViewProjection;

@vertex
fn lineVertexMain(input: LineVertexInput) -> LineVertexOutput {
    var output: LineVertexOutput;
    output.position = uViewProjection.viewProjection * vec4<f32>(input.position, 1.0);
    output.color = input.color;
    return output;
}

@fragment
fn lineFragmentMain(input: LineVertexOutput) -> @location(0) vec4<f32> {
    return vec4<f32>(input.color, 1.0);
}

// ============================================================================
// Solid Geometry Rendering (for cones, torus, etc.)
// ============================================================================

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

struct SolidUniforms {
    viewProjection: mat4x4<f32>,
    lightingEnabled: u32,
}

@group(0) @binding(0) var<uniform> uSolidUniforms: SolidUniforms;

@vertex
fn solidVertexMain(input: SolidVertexInput) -> SolidVertexOutput {
    var output: SolidVertexOutput;
    output.position = uSolidUniforms.viewProjection * vec4<f32>(input.position, 1.0);
    output.color = input.color;
    output.normal = input.normal;
    return output;
}

@fragment
fn solidFragmentMain(input: SolidVertexOutput) -> @location(0) vec4<f32> {
    var color = input.color;

    if (uSolidUniforms.lightingEnabled != 0u) {
        // Simple directional light from top-left
        let lightDir = normalize(vec3<f32>(0.5, 0.7, 1.0));
        let diff = max(dot(input.normal, lightDir), 0.3); // 0.3 ambient
        color = color * diff;
    }

    return vec4<f32>(color, 1.0);
}
