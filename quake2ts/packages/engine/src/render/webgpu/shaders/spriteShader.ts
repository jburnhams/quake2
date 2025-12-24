export const SPRITE_SHADER = `
// Sprite Rendering Shader (WGSL)

struct VertexInput {
  @location(0) position: vec2f,
  @location(1) texcoord: vec2f,
  @location(2) color: vec4f,
}

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) texcoord: vec2f,
  @location(1) color: vec4f,
}

struct Uniforms {
  projection: mat4x4f,
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  // Orthographic projection: Input is screen coords (pixels), Z is 0.0, W is 1.0
  output.position = uniforms.projection * vec4f(input.position, 0.0, 1.0);
  output.texcoord = input.texcoord;
  output.color = input.color;
  return output;
}

@group(1) @binding(0) var texSampler: sampler;
@group(1) @binding(1) var tex: texture_2d<f32>;

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4f {
  let texColor = textureSample(tex, texSampler, input.texcoord);
  return texColor * input.color;
}

@fragment
fn fs_solid(input: VertexOutput) -> @location(0) vec4f {
  return input.color;
}
`;
