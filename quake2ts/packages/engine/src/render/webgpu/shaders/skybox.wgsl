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

  // Pass the RAW position (not normalized) as direction
  // This preserves the face-relative direction and avoids corner tie issues
  // The cubemap sampler handles normalization internally
  var dir = position;

  // Apply scrolling in Quake horizontal plane (X/Y)
  // Small scrolling offset that doesn't break dominant component detection
  dir.x += uniforms.scroll.x * 0.01;
  dir.y += uniforms.scroll.y * 0.01;

  output.direction = dir;
  output.position = uniforms.viewProjection * vec4<f32>(position, 1.0);
  return output;
}

@fragment
fn fragmentMain(@location(0) direction: vec3<f32>) -> @location(0) vec4<f32> {
  // Transform from Quake coordinates to GL/WebGPU cubemap coordinates
  // Quake: +X forward, +Y left, +Z up
  // GL cubemap: +X right, +Y up, -Z forward
  var cubemapDir: vec3<f32>;
  cubemapDir.x = -direction.y;  // Quake +Y (left) → GL -X (left)
  cubemapDir.y = direction.z;   // Quake +Z (up) → GL +Y (up)
  cubemapDir.z = -direction.x;  // Quake +X (forward) → GL -Z (forward)

  return textureSample(t_skybox, s_skybox, cubemapDir);
}
