struct Uniforms {
  viewProjection: mat4x4<f32>,
  right: vec3<f32>,
  up: vec3<f32>,
};

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(1) @binding(0) var t_diffuse: texture_2d<f32>;
@group(1) @binding(1) var s_diffuse: sampler;

struct VertexInput {
  @location(0) position: vec3<f32>,  // Instance position (center)
  // UV is generated in shader from vertex_index
  @location(2) color: vec4<f32>,     // Instance color
  @location(3) size: f32,            // Instance size
  @builtin(vertex_index) vertexIndex: u32,
};

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>,
  @location(1) color: vec4<f32>,
};

@vertex
fn vertexMain(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;

  // Generate quad vertices from vertex_index (0-5 for two triangles)
  // 0: -1, -1 (0, 1)
  // 1:  1, -1 (1, 1)
  // 2: -1,  1 (0, 0)
  // 3: -1,  1 (0, 0)
  // 4:  1, -1 (1, 1)
  // 5:  1,  1 (1, 0)

  // UV coordinates for the quad
  var uv = vec2<f32>(0.0, 0.0);
  var corner = vec2<f32>(0.0, 0.0);

  let index = input.vertexIndex % 6u;

  if (index == 0u) {
    uv = vec2<f32>(0.0, 1.0);
    corner = vec2<f32>(-1.0, -1.0);
  } else if (index == 1u) {
    uv = vec2<f32>(1.0, 1.0);
    corner = vec2<f32>(1.0, -1.0);
  } else if (index == 2u) {
    uv = vec2<f32>(0.0, 0.0);
    corner = vec2<f32>(-1.0, 1.0);
  } else if (index == 3u) {
    uv = vec2<f32>(0.0, 0.0);
    corner = vec2<f32>(-1.0, 1.0);
  } else if (index == 4u) {
    uv = vec2<f32>(1.0, 1.0);
    corner = vec2<f32>(1.0, -1.0);
  } else if (index == 5u) {
    uv = vec2<f32>(1.0, 0.0);
    corner = vec2<f32>(1.0, 1.0);
  }

  let halfSize = input.size * 0.5;
  let worldPos = input.position
                 + (uniforms.right * corner.x * halfSize)
                 + (uniforms.up * corner.y * halfSize);

  output.position = uniforms.viewProjection * vec4<f32>(worldPos, 1.0);
  output.uv = uv;
  output.color = input.color;

  return output;
}

@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4<f32> {
  let textureColor = textureSample(t_diffuse, s_diffuse, input.uv);
  let alpha = input.color.a * textureColor.a;

  if (alpha <= 0.0) {
    discard;
  }

  return vec4<f32>(input.color.rgb * textureColor.rgb, alpha);
}
