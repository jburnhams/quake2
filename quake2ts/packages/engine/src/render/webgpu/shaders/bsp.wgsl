struct DLight {
    position: vec3<f32>,
    intensity: f32,
    color: vec3<f32>,
    padding: f32,
}

struct FrameUniforms {
    viewProjection: mat4x4<f32>,    // 0-64
    cameraPosition: vec3<f32>,      // 64-76
    pad0: f32,                      // 76-80 (Explicit padding to align next field to 80)
    time: f32,                      // 80-84
    brightness: f32,                // 84-88
    gamma: f32,                     // 88-92
    ambient: f32,                   // 92-96
    numDlights: u32,                // 96-100
    fullbright: u32,                // 100-104
    pad1: vec2<f32>,                // 104-112 (Aligns next field to 112)
    pad2: vec4<f32>,                // 112-128 (Aligns next field to 128)
    dlights: array<DLight, 32>,     // Starts at 128
}

struct SurfaceUniforms {
    texScroll: vec2<f32>,
    lightmapScroll: vec2<f32>,
    lightStyleFactors: vec4<f32>,
    styleLayerMapping: vec4<f32>,
    solidColor: vec4<f32>,
    alpha: f32,
    applyLightmap: u32,
    warp: u32,
    lightmapOnly: u32,
    renderMode: u32, // 0: Texture, 1: Solid, 2: Faceted
    padding: vec3<f32>,
}

@group(0) @binding(0) var<uniform> frame: FrameUniforms;
@group(1) @binding(0) var<uniform> surface: SurfaceUniforms;
@group(2) @binding(0) var diffuseMap: texture_2d<f32>;
@group(2) @binding(1) var diffuseSampler: sampler;
@group(2) @binding(2) var lightmapAtlas: texture_2d<f32>;
@group(2) @binding(3) var lightmapSampler: sampler;

struct VertexInput {
    @location(0) position: vec3<f32>,
    @location(1) texCoord: vec2<f32>,
    @location(2) lightmapCoord: vec2<f32>,
    @location(3) lightmapStep: f32,
}

struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) texCoord: vec2<f32>,
    @location(1) lightmapCoord: vec2<f32>,
    @location(2) lightmapStep: f32,
    @location(3) worldPos: vec3<f32>,
    @location(4) screenPos: vec4<f32>,
}

@vertex
fn vertexMain(input: VertexInput) -> VertexOutput {
    var output: VertexOutput;

    var pos = input.position;
    var tex = input.texCoord;
    var lm = input.lightmapCoord;

    // Vertex Warping
    if (surface.warp != 0u) {
        let amp = 0.125;
        let s = tex.x + sin((tex.y * 0.125 + frame.time) * 1.0) * amp;
        let t = tex.y + sin((tex.x * 0.125 + frame.time) * 1.0) * amp;
        tex = vec2<f32>(s, t);
    }

    output.texCoord = tex + surface.texScroll;
    output.lightmapCoord = lm + surface.lightmapScroll;
    output.lightmapStep = input.lightmapStep;
    output.worldPos = pos;
    output.position = frame.viewProjection * vec4<f32>(pos, 1.0);
    output.screenPos = output.position;

    return output;
}

@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4<f32> {
    var finalColor: vec4<f32>;

    if (surface.renderMode == 0u) {
        // TEXTURED MODE
        var base = vec4<f32>(1.0, 1.0, 1.0, 1.0);
        if (surface.lightmapOnly == 0u) {
            base = textureSample(diffuseMap, diffuseSampler, input.texCoord);
        }

        var totalLight = vec3<f32>(0.0, 0.0, 0.0);

        if (frame.fullbright != 0u) {
            totalLight = vec3<f32>(1.0, 1.0, 1.0);
        } else {
            // Apply Lightmaps
            if (surface.applyLightmap != 0u) {
                var hasLight = false;
                for (var i = 0; i < 4; i++) {
                    let layer = surface.styleLayerMapping[i];
                    let factor = surface.lightStyleFactors[i];

                    if (layer >= -0.5) {
                        let offset = vec2<f32>(0.0, layer * input.lightmapStep);
                        totalLight += textureSample(lightmapAtlas, lightmapSampler, input.lightmapCoord + offset).rgb * factor;
                        hasLight = true;
                    }
                }

                // If lightmap enabled but no active layers, fallback to white?
                // Quake 2 logic usually implies at least one style is active if surfaced has SURF_LIGHT
                // But if we have no lightmap data, we start black.
                if (!hasLight) {
                    // Fallback to avoid pitch black if lightmap intended but missing?
                    // totalLight = vec3<f32>(1.0, 1.0, 1.0);
                }
            }

            // Apply Dynamic Lights
            for (var i = 0u; i < 32u; i++) {
                if (i >= frame.numDlights) {
                    break;
                }
                let dlight = frame.dlights[i];
                let dist = distance(input.worldPos, dlight.position);

                if (dist < dlight.intensity) {
                    let contribution = (dlight.intensity - dist) * (1.0 / 255.0);
                    totalLight += dlight.color * contribution;
                }
            }
        }

        totalLight = max(totalLight, vec3<f32>(frame.ambient));
        totalLight *= frame.brightness;
        base = vec4<f32>(base.rgb * totalLight, base.a);

        // Gamma correction
        if (frame.gamma != 1.0) {
            base = vec4<f32>(pow(base.rgb, vec3<f32>(1.0 / frame.gamma)), base.a);
        }

        finalColor = vec4<f32>(base.rgb, base.a * surface.alpha);

    } else {
        // SOLID / WIREFRAME / FACETED
        var color = surface.solidColor.rgb;
        if (surface.renderMode == 2u) {
            // FACETED
            let fdx = dpdx(input.worldPos);
            let fdy = dpdy(input.worldPos);
            let faceNormal = normalize(cross(fdx, fdy));
            let lightDir = normalize(vec3<f32>(0.5, 0.5, 1.0));
            let diff = max(dot(faceNormal, lightDir), 0.2);
            color *= diff;
        }
        finalColor = vec4<f32>(color, surface.solidColor.a * surface.alpha);
    }

    // Alpha Test (Simple discard for fence textures if alpha is very low)
    if (finalColor.a < 0.01) {
        discard;
    }

    return finalColor;
}
