struct VertexInput {
  @location(0) positionFrame1: vec3<f32>,
  @location(1) normalFrame1: vec3<f32>,
  @location(2) positionFrame2: vec3<f32>,
  @location(3) normalFrame2: vec3<f32>,
  @location(4) texcoord: vec2<f32>,
}

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) texcoord: vec2<f32>,
  @location(1) lightColor: vec3<f32>,
  @location(2) worldPosition: vec3<f32>, // For faceted shading
}

struct DLight {
  position: vec3<f32>,
  pad1: f32, // align to 16 bytes
  color: vec3<f32>,
  intensity: f32,
}

// Keep in sync with MAX_DLIGHTS
const MAX_DLIGHTS: u32 = 32;

struct GlobalUniforms {
  modelViewProjection: mat4x4<f32>,
  modelMatrix: mat4x4<f32>,
  lightDir: vec3<f32>,
  ambient: f32,
  tint: vec4<f32>,

  // Render mode controls
  renderMode: u32, // 0: Textured, 1: Solid, 2: Solid Faceted
  pad2: f32,
  pad3: f32,
  pad4: f32,
  solidColor: vec4<f32>,

  // Lighting controls
  numDlights: u32,
  brightness: f32,
  gamma: f32,
  globalAmbient: f32,
  fullbright: u32, // boolean as u32
  pad5: f32,
  pad6: f32,
  pad7: f32,

  dlights: array<DLight, 32>,
}

struct FrameUniforms {
    frameBlend: f32,
}

@group(0) @binding(0) var<uniform> global: GlobalUniforms;
@group(0) @binding(1) var<uniform> frame: FrameUniforms;
@group(0) @binding(2) var t_diffuse: texture_2d<f32>;
@group(0) @binding(3) var s_diffuse: sampler;

@vertex
fn vertexMain(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;

  // Interpolate position and normal
  let position = mix(input.positionFrame1, input.positionFrame2, frame.frameBlend);
  let normal = normalize(mix(input.normalFrame1, input.normalFrame2, frame.frameBlend));

  // Directional Light (Lambert)
  let dotL = max(dot(normal, normalize(global.lightDir)), 0.0);
  var lightAcc = vec3<f32>(min(1.0, global.ambient + dotL));

  // World position for dynamic lights and faceted shading
  let worldPos = global.modelMatrix * vec4<f32>(position, 1.0);

  // Dynamic Lights
  for (var i = 0u; i < MAX_DLIGHTS; i++) {
    if (i >= global.numDlights) {
      break;
    }
    let dlight = global.dlights[i];
    let dist = distance(worldPos.xyz, dlight.position);
    if (dist < dlight.intensity) {
      let intensity = (dlight.intensity - dist) / dlight.intensity;
      lightAcc += dlight.color * intensity;
    }
  }

  output.lightColor = lightAcc;
  output.texcoord = input.texcoord;
  output.worldPosition = worldPos.xyz;
  output.position = global.modelViewProjection * vec4<f32>(position, 1.0);

  return output;
}

@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4<f32> {
  var finalColor: vec4<f32>;

  if (global.renderMode == 0u) {
    // Textured
    let albedo = textureSample(t_diffuse, s_diffuse, input.texcoord) * global.tint;
    var light = input.lightColor;

    if (global.fullbright != 0u) {
      light = vec3<f32>(1.0);
    }

    // Global ambient minimum
    light = max(light, vec3<f32>(global.globalAmbient));
    light *= global.brightness;

    var rgb = albedo.rgb * light;

    if (global.gamma != 1.0) {
      rgb = pow(rgb, vec3<f32>(1.0 / global.gamma));
    }

    finalColor = vec4<f32>(rgb, albedo.a);
  } else {
    // Solid / Faceted
    var color = global.solidColor.rgb;
    if (global.renderMode == 2u) {
      // Faceted
      let fdx = dpdx(input.worldPosition);
      let fdy = dpdy(input.worldPosition);
      let faceNormal = normalize(cross(fdx, fdy));
      let lightDir = normalize(vec3<f32>(0.5, 0.5, 1.0));
      let diff = max(dot(faceNormal, lightDir), 0.2);
      color *= diff;
    }
    finalColor = vec4<f32>(color, global.solidColor.a * global.tint.a);
  }

  return finalColor;
}
