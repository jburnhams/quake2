// MD3 Shader

struct Uniforms {
  viewProjection: mat4x4<f32>,
  modelMatrix: mat4x4<f32>,
  // Lighting is now primarily vertex-based from CPU, but we keep uniforms for tinting/global overrides if needed
  tint: vec4<f32>,
};

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var diffuseTexture: texture_2d<f32>;
@group(0) @binding(2) var textureSampler: sampler;

struct VertexInput {
  @location(0) position: vec3<f32>,
  @location(1) normal: vec3<f32>,
  @location(2) uv: vec2<f32>,
  @location(3) color: vec3<f32>, // Vertex color from CPU lighting
};

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>,
  @location(1) color: vec3<f32>,
};

@vertex
fn vertexMain(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;

  // Transform position
  let worldPos = uniforms.modelMatrix * vec4<f32>(input.position, 1.0);
  output.position = uniforms.viewProjection * worldPos;

  output.uv = input.uv;
  output.color = input.color;
  return output;
}

@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4<f32> {
  let texColor = textureSample(diffuseTexture, textureSampler, input.uv);

  // Combine texture color with vertex color (lighting) and global tint
  let finalRgb = texColor.rgb * input.color * uniforms.tint.rgb;
  let finalAlpha = texColor.a * uniforms.tint.a;

  let finalColor = vec4<f32>(finalRgb, finalAlpha);

  // Alpha discard
  if (finalColor.a < 0.1) {
    discard;
  }

  return finalColor;
}
