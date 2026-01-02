// Skybox shader using full-screen triangle approach
// This avoids the w≈0 issue with cube geometry at diagonal view angles
// by computing the world-space direction analytically per-pixel

struct Uniforms {
  // Inverse view rotation matrix (view→world transform for directions)
  // Stored as 3 vec4s due to std140 padding
  inverseViewRotation_col0: vec4<f32>,
  inverseViewRotation_col1: vec4<f32>,
  inverseViewRotation_col2: vec4<f32>,
  tanHalfFov: f32,
  aspect: f32,
  scroll: vec2<f32>,
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var t_skybox: texture_cube<f32>;
@group(0) @binding(2) var s_skybox: sampler;

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
}

@vertex
fn vertexMain(@location(0) position: vec2<f32>) -> VertexOutput {
  var output: VertexOutput;

  // Position is already in NDC space (-1 to 1)
  output.position = vec4<f32>(position, 0.999, 1.0);  // z near 1.0 for far plane

  return output;
}

// Hard-coded screen size for now (should be passed as uniform)
const SCREEN_SIZE: vec2<f32> = vec2<f32>(256.0, 256.0);

@fragment
fn fragmentMain(@builtin(position) fragCoord: vec4<f32>) -> @location(0) vec4<f32> {
  // Compute NDC from fragment coordinates
  // fragCoord.xy is in framebuffer coordinates (0 to width, 0 to height)
  // NDC.x: 0 -> -1, width -> +1
  // NDC.y: 0 -> +1, height -> -1 (Y is flipped in WebGPU framebuffer)
  let ndc = vec2<f32>(
    (fragCoord.x / SCREEN_SIZE.x) * 2.0 - 1.0,
    1.0 - (fragCoord.y / SCREEN_SIZE.y) * 2.0
  );
  // Get columns directly from uniforms
  let col0 = uniforms.inverseViewRotation_col0.xyz;
  let col1 = uniforms.inverseViewRotation_col1.xyz;
  let col2 = uniforms.inverseViewRotation_col2.xyz;

  // Compute view-space direction from NDC
  // The view-space ray direction for a pixel at NDC (x, y) with perspective projection:
  // viewDir = normalize(vec3(x * aspect * tanHalfFov, y * tanHalfFov, -1.0))
  // Note: -1.0 for Z because we look down -Z in view space
  let viewDir = normalize(vec3<f32>(
    ndc.x * uniforms.aspect * uniforms.tanHalfFov,
    ndc.y * uniforms.tanHalfFov,
    -1.0
  ));

  // Transform view-space direction to world-space (Quake coordinates)
  // Manually unroll: worldDir = col0 * viewDir.x + col1 * viewDir.y + col2 * viewDir.z
  var worldDir = col0 * viewDir.x + col1 * viewDir.y + col2 * viewDir.z;

  // Transform from Quake coordinates to GL/WebGPU cubemap coordinates
  // Quake: +X forward, +Y left, +Z up
  // GL cubemap: +X right, +Y up, -Z forward
  var cubemapDir: vec3<f32>;
  cubemapDir.x = -worldDir.y;  // Quake +Y (left) → GL -X (left)
  cubemapDir.y = worldDir.z;   // Quake +Z (up) → GL +Y (up)
  cubemapDir.z = -worldDir.x;  // Quake +X (forward) → GL -Z (forward)

  // Apply skybox scroll by rotating the cubemap around the vertical (Y) axis
  // This rotates the entire skybox, scrolling textures while maintaining face relationships
  // Rotation around Y axis: newX = X*cos(θ) - Z*sin(θ), newZ = X*sin(θ) + Z*cos(θ)
  // For 2 checkerboard squares (90° rotation): need ~1.57 radians at scroll=2.0
  let scrollAngle = uniforms.scroll.x * 0.8; // Scale to radians
  let cosAngle = cos(scrollAngle);
  let sinAngle = sin(scrollAngle);

  let rotatedX = cubemapDir.x * cosAngle - cubemapDir.z * sinAngle;
  let rotatedZ = cubemapDir.x * sinAngle + cubemapDir.z * cosAngle;

  cubemapDir.x = rotatedX;
  cubemapDir.z = rotatedZ;
  // cubemapDir.y unchanged - rotation around Y axis

  return textureSample(t_skybox, s_skybox, cubemapDir);
}
