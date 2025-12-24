export const MIPMAP_SHADER = `
struct VSOutput {
  @builtin(position) position: vec4f,
  @location(0) texcoord: vec2f,
};

@vertex
fn vs_main(@builtin(vertex_index) vertexIndex : u32) -> VSOutput {
  var pos = array<vec2f, 6>(
    vec2f(-1.0, -1.0), vec2f(1.0, -1.0), vec2f(-1.0, 1.0),
    vec2f(-1.0, 1.0), vec2f(1.0, -1.0), vec2f(1.0, 1.0)
  );

  var output: VSOutput;
  output.position = vec4f(pos[vertexIndex], 0.0, 1.0);
  // Remap from [-1, 1] to [0, 1] for texcoord, Y is flipped in WebGPU clip space vs texture UV
  // Clip space: (-1,-1) is bottom-left. UV: (0,0) is top-left usually?
  // Wait, WebGPU clip space Y is up. UV (0,0) is top-left.
  // Quad vertices are full screen.
  output.texcoord = pos[vertexIndex] * vec2f(0.5, -0.5) + vec2f(0.5, 0.5);
  return output;
}

@group(0) @binding(0) var imgSampler: sampler;
@group(0) @binding(1) var img: texture_2d<f32>;

@fragment
fn fs_main(in: VSOutput) -> @location(0) vec4f {
  return textureSample(img, imgSampler, in.texcoord);
}
`;
