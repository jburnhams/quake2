struct Uniforms {
  viewProjection: mat4x4<f32>,
  scroll: vec2<f32>,
  useNative: f32, // 0.0 = old (swizzle), 1.0 = new (native)
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

  var qDir = normalize(position);
  qDir.x += uniforms.scroll.x;
  qDir.y += uniforms.scroll.y;

  if (uniforms.useNative > 0.5) {
      // Native: Matrix handles transform, no swizzle
      output.direction = qDir;
  } else {
      // Legacy: Swizzle Quake (Z-up) to WebGL (Y-up)
      // Quake X  -> GL -Z
      // Quake Y  -> GL -X
      // Quake Z  -> GL Y
      output.direction = vec3<f32>(-qDir.y, qDir.z, -qDir.x);
  }

  output.position = uniforms.viewProjection * vec4<f32>(position, 1.0);
  return output;
}

@fragment
fn fragmentMain(@location(0) direction: vec3<f32>) -> @location(0) vec4<f32> {
  return textureSample(t_skybox, s_skybox, direction);
}
