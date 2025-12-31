// Skybox shader using native coordinate system (Task 22-4)

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

  // Direction for cubemap sampling
  // The vertex position (local space) is the direction vector from center.
  var dir = normalize(position);

  // Apply scroll to direction
  dir.x += uniforms.scroll.x * 0.01; // Scale scroll to match legacy behavior
  dir.y += uniforms.scroll.y * 0.01;

  // NO TRANSFORM - matrices handle it!
  // The WebGPUMatrixBuilder already handles the coordinate system transform
  // (Quake Space -> WebGPU View Space).
  // However, we need to ensure the texture coordinates map correctly to the Cubemap faces.
  //
  // Quake +X (Forward) -> Cubemap -Z (Forward) ?
  // If MatrixBuilder puts Camera looking down -Z.
  // And we render a Cube defined in Quake Space (X-Forward).
  // Then Vertex(1,0,0) is at Quake +X.
  // View Matrix transforms this to View Space (0,0,-1).
  // The Vertex Shader outputs this projected position.
  //
  // For Sampling:
  // If we use 'dir' (Quake Space Position) as texture coordinate:
  // sample(dir(1,0,0)) samples +X face of cubemap.
  // Standard GL Cubemap +X is Right.
  // But Quake +X is Forward.
  // So we see "Right" texture when looking Forward.
  //
  // So we DO need to permute the coordinates for sampling to match Quake->GL Cubemap mapping.
  // Quake X (Forward) -> GL -Z (Forward)
  // Quake Y (Left)    -> GL -X (Left)
  // Quake Z (Up)      -> GL +Y (Up)

  // Wait, the documentation explicitly said: "NO TRANSFORM - matrices handle it!".
  // This implies either:
  // 1. The Cubemap texture data itself is swizzled during load.
  // 2. The MatrixBuilder rotates the "World" such that Quake X aligns with GL X? No.
  //
  // If I follow the doc strictly ("NO TRANSFORM"), I should just output dir.
  // But if the visual output is wrong (rotated 90 degrees), then the Doc assumption was wrong about texture sampling.
  //
  // Let's assume the doc is correct and the system (maybe texture loading or matrix builder) handles it.
  // BUT the Doc's "OLD (BUGGY)" code explicitly removed:
  // output.direction = vec3<f32>(-dir.y, dir.z, -dir.x);
  //
  // If I remove it, I am using `output.direction = dir`.
  //
  // Let's implement exactly what the Doc says for Task 2 "NEW (FIXED)".

  output.direction = dir;

  output.position = uniforms.viewProjection * vec4<f32>(position, 1.0);
  // Force Z to far plane (w) so it renders behind everything.
  // In WebGPU, clip space Z is 0..1. Far plane is 1.
  // If we set Z = W, then Z/W = 1.
  output.position.z = output.position.w;

  return output;
}

@fragment
fn fragmentMain(@location(0) direction: vec3<f32>) -> @location(0) vec4<f32> {
  // We might need to flip or rotate here if the vertex shader didn't do it.
  // But following the "Native Coordinate System" plan, we trust the matrices and straightforward sampling.
  // However, standard cubemap sampling:
  // If direction is (1,0,0), it samples +X face.

  // If we find the skybox is rotated, we will need to re-introduce a coordinate swizzle
  // or fix the cubemap loading. For now, strictly follow Task 2 spec.

  return textureSample(t_skybox, s_skybox, direction);
}
