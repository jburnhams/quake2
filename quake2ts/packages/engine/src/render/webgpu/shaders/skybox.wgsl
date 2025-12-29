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

  // Transform Quake coordinates (X-Fwd, Y-Left, Z-Up)
  // to WebGPU/GL cubemap coordinates (Right-handed? -Z Fwd, +X Right, +Y Up)
  // Quake X  -> GL -Z
  // Quake Y  -> GL -X
  // Quake Z  -> GL Y
  let qDir = normalize(position);
  var dir = vec3<f32>(-qDir.y, qDir.z, -qDir.x);

  // Apply scroll
  dir.x += uniforms.scroll.x;
  dir.y += uniforms.scroll.y;

  output.direction = dir;

  output.position = uniforms.viewProjection * vec4<f32>(position, 1.0);
  return output;
}

@fragment
fn fragmentMain(@location(0) direction: vec3<f32>) -> @location(0) vec4<f32> {
  return textureSample(t_skybox, s_skybox, direction);
}
