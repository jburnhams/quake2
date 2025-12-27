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

  // Calculate direction with scroll offset
  // The skybox mesh vertices are in GL coordinates (X right, Y up, Z back).
  // These directions are used directly to sample the cubemap.
  // No coordinate transform is needed here - the view matrix already handles
  // the Quake→GL coordinate transform.

  var dir = normalize(position);
  dir.x += uniforms.scroll.x;
  dir.y += uniforms.scroll.y;

  output.direction = dir;

  // Calculate position
  output.position = uniforms.viewProjection * vec4<f32>(position, 1.0);

  // Ensure skybox is always at maximum depth (if needed)
  // or just rely on drawing order and depth writes disabled

  return output;
}

@fragment
fn fragmentMain(@location(0) direction: vec3<f32>) -> @location(0) vec4<f32> {
  return textureSample(t_skybox, s_skybox, direction);
}
