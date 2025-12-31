struct Uniforms {
  viewProjection: mat4x4<f32>,
  scroll: vec2<f32>,
  useNative: f32, // Feature flag: 1.0 = native (new), 0.0 = legacy (old)
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
  var cubemapDir = direction;

  // If using legacy path, apply the fixup transform.
  // The native path builds matrices that handle coordinate system changes correctly,
  // so no manual swizzling is required in the shader.
  if (uniforms.useNative == 0.0) {
      // Legacy transform from Quake coordinates to GL/WebGPU cubemap coordinates
      // Quake: +X forward, +Y left, +Z up
      // GL cubemap: +X right, +Y up, -Z forward
      cubemapDir = vec3<f32>(-direction.y, direction.z, -direction.x);
  }

  return textureSample(t_skybox, s_skybox, cubemapDir);
}
