struct Uniforms {
  viewProjection: mat4x4<f32>,
  scroll: vec2<f32>,
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var t_skybox: texture_cube<f32>;
@group(0) @binding(2) var s_skybox: sampler;

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) direction: vec3<f32>,
}

@vertex
fn vertexMain(@location(0) position: vec3<f32>) -> VertexOutput {
  var output: VertexOutput;

  // Normalize input position (Quake Coordinates)
  var qDir = normalize(position);

  // Apply scrolling in Quake Coordinates (Horizontal Plane X/Y)
  // This ensures clouds scroll horizontally regardless of the final mapping.
  qDir.x += uniforms.scroll.x;
  qDir.y += uniforms.scroll.y;

  // Transform Quake coordinates (X-Fwd, Y-Left, Z-Up)
  // to WebGPU/GL cubemap coordinates (Right-handed? -Z Fwd, +X Right, +Y Up)
  // Quake X  -> GL -Z
  // Quake Y  -> GL -X
  // Quake Z  -> GL Y
  var dir = vec3<f32>(-qDir.y, qDir.z, -qDir.x);

  output.direction = dir;

  output.position = uniforms.viewProjection * vec4<f32>(position, 1.0);
  return output;
}

@fragment
fn fragmentMain(@location(0) direction: vec3<f32>) -> @location(0) vec4<f32> {
  return textureSample(t_skybox, s_skybox, direction);
}
