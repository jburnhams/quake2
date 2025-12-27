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

  // Calculate direction with scroll offset applied in GL space
  var dir = normalize(position);
  dir.x += uniforms.scroll.x;
  dir.y += uniforms.scroll.y;

  // Transform GL direction to cubemap sampling direction
  // The skybox mesh is in GL coordinates (X right, Y up, Z back) but the
  // cubemap faces are mapped for Quake coordinate lookups. This transform
  // converts the direction for correct face sampling.
  //
  // Note: This transform works correctly for cardinal directions but has
  // known issues with diagonal views (see SKYBOX_INVESTIGATION.md).
  output.direction = vec3<f32>(-dir.y, dir.z, -dir.x);

  output.position = uniforms.viewProjection * vec4<f32>(position, 1.0);

  return output;
}

@fragment
fn fragmentMain(@location(0) direction: vec3<f32>) -> @location(0) vec4<f32> {
  return textureSample(t_skybox, s_skybox, direction);
}
