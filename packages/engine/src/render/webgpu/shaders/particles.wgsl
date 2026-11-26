// Particles: the shared camera-facing quads from ParticleSystem.buildMesh, the same vertices the
// WebGL backend draws, with the same soft round dot in the fragment shader.

struct Uniforms {
  viewProjection: mat4x4<f32>,
};

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(1) @binding(0) var t_diffuse: texture_2d<f32>;
@group(1) @binding(1) var s_diffuse: sampler;

struct VertexInput {
  @location(0) position: vec3<f32>,
  @location(1) uv: vec2<f32>,
  @location(2) color: vec4<f32>,
};

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>,
  @location(1) color: vec4<f32>,
};

@vertex
fn vertexMain(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  output.position = uniforms.viewProjection * vec4<f32>(input.position, 1.0);
  output.uv = input.uv;
  output.color = input.color;
  return output;
}

@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4<f32> {
  // The dot, as PARTICLE_FRAGMENT_SHADER draws it; a particle with a texture is that texture inside it.
  let dist = distance(input.uv, vec2<f32>(0.5, 0.5));
  let textureColor = textureSample(t_diffuse, s_diffuse, input.uv);
  let alpha = input.color.a * textureColor.a * (1.0 - smoothstep(0.35, 0.5, dist));
  return vec4<f32>(input.color.rgb * textureColor.rgb, alpha);
}
