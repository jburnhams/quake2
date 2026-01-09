import { mat4, vec3, vec4 } from 'gl-matrix';
import {
  VertexBuffer,
  UniformBuffer,
  BindGroup,
  BindGroupBuilder,
  RenderPipeline,
  ShaderModule,
} from '../resources.js';
import { Vec3 } from '@quake2ts/shared';
import DEBUG_SHADER from '../shaders/debug.wgsl?raw';

export interface Color {
  r: number;
  g: number;
  b: number;
}

interface TextLabel {
  text: string;
  position: Vec3;
}

function toGlVec3(v: Vec3): vec3 {
  return vec3.fromValues(v.x, v.y, v.z);
}

function fromGlVec3(v: vec3): Vec3 {
  return { x: v[0], y: v[1], z: v[2] };
}

export class DebugPipeline {
  private linePipeline: RenderPipeline;
  private solidPipeline: RenderPipeline;

  private lineVertexBuffer: VertexBuffer;
  private solidVertexBuffer: VertexBuffer;

  private lineUniformBuffer: UniformBuffer;
  private solidUniformBuffer: UniformBuffer;

  private lineBindGroup: BindGroup;
  private solidBindGroup: BindGroup;

  private lineVertices: number[] = [];
  private solidVertices: number[] = [];
  private labels: TextLabel[] = [];

  constructor(
    private device: GPUDevice,
    private format: GPUTextureFormat,
    private depthFormat: GPUTextureFormat = 'depth24plus'
  ) {
    // Compile Shader
    const shaderModule = new ShaderModule(device, {
      code: DEBUG_SHADER,
      label: 'debug-shader'
    });

    // =====================================================================
    // Line Pipeline (for wireframes, bounding boxes, normals, axes)
    // =====================================================================

    // Line vertex layout: position(3), color(3)
    const lineVertexBufferLayout: GPUVertexBufferLayout = {
      arrayStride: 6 * 4, // 6 floats per vertex
      stepMode: 'vertex',
      attributes: [
        { format: 'float32x3', offset: 0, shaderLocation: 0 },  // position
        { format: 'float32x3', offset: 12, shaderLocation: 1 }, // color
      ]
    };

    // Line uniform bind group (ViewProjection matrix)
    const lineBindGroupBuilder = new BindGroupBuilder('debug-line-uniform-layout');
    lineBindGroupBuilder.addUniformBuffer(0, GPUShaderStage.VERTEX);
    const lineBindGroupLayout = lineBindGroupBuilder.build(device);

    const linePipelineLayout = device.createPipelineLayout({
      bindGroupLayouts: [lineBindGroupLayout.layout],
      label: 'debug-line-pipeline-layout'
    });

    this.linePipeline = new RenderPipeline(device, {
      layout: linePipelineLayout,
      vertex: {
        module: shaderModule,
        entryPoint: 'lineVertexMain',
        buffers: [lineVertexBufferLayout]
      },
      fragment: {
        module: shaderModule,
        entryPoint: 'lineFragmentMain',
        targets: [{ format: this.format }]
      },
      primitive: {
        topology: 'line-list',
        cullMode: 'none'
      },
      depthStencil: {
        format: this.depthFormat,
        depthWriteEnabled: true,
        depthCompare: 'less'
      },
      label: 'debug-line-pipeline'
    });

    // =====================================================================
    // Solid Pipeline (for cones, torus, etc.)
    // =====================================================================

    // Solid vertex layout: position(3), color(3), normal(3)
    const solidVertexBufferLayout: GPUVertexBufferLayout = {
      arrayStride: 9 * 4, // 9 floats per vertex
      stepMode: 'vertex',
      attributes: [
        { format: 'float32x3', offset: 0, shaderLocation: 0 },  // position
        { format: 'float32x3', offset: 12, shaderLocation: 1 }, // color
        { format: 'float32x3', offset: 24, shaderLocation: 2 }, // normal
      ]
    };

    // Solid uniform bind group (ViewProjection matrix + lighting flag)
    const solidBindGroupBuilder = new BindGroupBuilder('debug-solid-uniform-layout');
    solidBindGroupBuilder.addUniformBuffer(0, GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT);
    const solidBindGroupLayout = solidBindGroupBuilder.build(device);

    const solidPipelineLayout = device.createPipelineLayout({
      bindGroupLayouts: [solidBindGroupLayout.layout],
      label: 'debug-solid-pipeline-layout'
    });

    this.solidPipeline = new RenderPipeline(device, {
      layout: solidPipelineLayout,
      vertex: {
        module: shaderModule,
        entryPoint: 'solidVertexMain',
        buffers: [solidVertexBufferLayout]
      },
      fragment: {
        module: shaderModule,
        entryPoint: 'solidFragmentMain',
        targets: [{ format: this.format }]
      },
      primitive: {
        topology: 'triangle-list',
        cullMode: 'back'
      },
      depthStencil: {
        format: this.depthFormat,
        depthWriteEnabled: true,
        depthCompare: 'less'
      },
      label: 'debug-solid-pipeline'
    });

    // =====================================================================
    // Create Buffers and Bind Groups
    // =====================================================================

    // Line buffers (pre-allocate for 10000 vertices = 5000 lines)
    this.lineVertexBuffer = new VertexBuffer(device, {
      size: 10000 * 6 * 4,
      label: 'debug-line-vertex-buffer'
    });

    // Solid buffers (pre-allocate for 10000 vertices)
    this.solidVertexBuffer = new VertexBuffer(device, {
      size: 10000 * 9 * 4,
      label: 'debug-solid-vertex-buffer'
    });

    // Line uniform buffer (4x4 matrix = 64 bytes)
    this.lineUniformBuffer = new UniformBuffer(device, {
      size: 64,
      label: 'debug-line-uniform-buffer'
    });

    // Solid uniform buffer (4x4 matrix + u32 lighting flag = 64 + 4 = 68 bytes, padded to 80)
    this.solidUniformBuffer = new UniformBuffer(device, {
      size: 80,
      label: 'debug-solid-uniform-buffer'
    });

    // Create bind groups
    this.lineBindGroup = new BindGroup(device, lineBindGroupLayout, [
      { binding: 0, resource: { buffer: this.lineUniformBuffer.buffer } }
    ], 'debug-line-bind-group');

    this.solidBindGroup = new BindGroup(device, solidBindGroupLayout, [
      { binding: 0, resource: { buffer: this.solidUniformBuffer.buffer } }
    ], 'debug-solid-bind-group');
  }

  // =========================================================================
  // Drawing API
  // =========================================================================

  drawLine(start: Vec3, end: Vec3, color: Color): void {
    this.lineVertices.push(
      start.x, start.y, start.z, color.r, color.g, color.b,
      end.x, end.y, end.z, color.r, color.g, color.b
    );
  }

  drawBoundingBox(mins: Vec3, maxs: Vec3, color: Color): void {
    const { x: x1, y: y1, z: z1 } = mins;
    const { x: x2, y: y2, z: z2 } = maxs;

    // Bottom face
    this.drawLine({ x: x1, y: y1, z: z1 }, { x: x2, y: y1, z: z1 }, color);
    this.drawLine({ x: x2, y: y1, z: z1 }, { x: x2, y: y2, z: z1 }, color);
    this.drawLine({ x: x2, y: y2, z: z1 }, { x: x1, y: y2, z: z1 }, color);
    this.drawLine({ x: x1, y: y2, z: z1 }, { x: x1, y: y1, z: z1 }, color);

    // Top face
    this.drawLine({ x: x1, y: y1, z: z2 }, { x: x2, y: y1, z: z2 }, color);
    this.drawLine({ x: x2, y: y1, z: z2 }, { x: x2, y: y2, z: z2 }, color);
    this.drawLine({ x: x2, y: y2, z: z2 }, { x: x1, y: y2, z: z2 }, color);
    this.drawLine({ x: x1, y: y2, z: z2 }, { x: x1, y: y1, z: z2 }, color);

    // Vertical edges
    this.drawLine({ x: x1, y: y1, z: z1 }, { x: x1, y: y1, z: z2 }, color);
    this.drawLine({ x: x2, y: y1, z: z1 }, { x: x2, y: y1, z: z2 }, color);
    this.drawLine({ x: x2, y: y2, z: z1 }, { x: x2, y: y2, z: z2 }, color);
    this.drawLine({ x: x1, y: y2, z: z1 }, { x: x1, y: y2, z: z2 }, color);
  }

  drawPoint(position: Vec3, size: number, color: Color): void {
    const s = size / 2;
    this.drawBoundingBox(
      { x: position.x - s, y: position.y - s, z: position.z - s },
      { x: position.x + s, y: position.y + s, z: position.z + s },
      color
    );
  }

  drawAxes(position: Vec3, size: number): void {
    this.drawLine(position, { x: position.x + size, y: position.y, z: position.z }, { r: 1, g: 0, b: 0 }); // X - Red
    this.drawLine(position, { x: position.x, y: position.y + size, z: position.z }, { r: 0, g: 1, b: 0 }); // Y - Green
    this.drawLine(position, { x: position.x, y: position.y, z: position.z + size }, { r: 0, g: 0, b: 1 }); // Z - Blue
  }

  drawText3D(text: string, position: Vec3): void {
    this.labels.push({ text, position });
  }

  private addTriangle(v1: Vec3, v2: Vec3, v3: Vec3, normal: Vec3, color: Color): void {
    // v1
    this.solidVertices.push(v1.x, v1.y, v1.z);
    this.solidVertices.push(color.r, color.g, color.b);
    this.solidVertices.push(normal.x, normal.y, normal.z);
    // v2
    this.solidVertices.push(v2.x, v2.y, v2.z);
    this.solidVertices.push(color.r, color.g, color.b);
    this.solidVertices.push(normal.x, normal.y, normal.z);
    // v3
    this.solidVertices.push(v3.x, v3.y, v3.z);
    this.solidVertices.push(color.r, color.g, color.b);
    this.solidVertices.push(normal.x, normal.y, normal.z);
  }

  addCone(apex: Vec3, baseCenter: Vec3, baseRadius: number, color: Color): void {
    const segments = 16;

    // Calculate axis and basis vectors using gl-matrix
    const apexGl = toGlVec3(apex);
    const baseCenterGl = toGlVec3(baseCenter);

    const axis = vec3.create();
    vec3.subtract(axis, apexGl, baseCenterGl);
    vec3.normalize(axis, axis);

    // Arbitrary up vector to find right vector
    let up = vec3.fromValues(0, 0, 1);
    if (Math.abs(vec3.dot(axis, up)) > 0.99) {
      up = vec3.fromValues(0, 1, 0);
    }

    const right = vec3.create();
    vec3.cross(right, up, axis);
    vec3.normalize(right, right);

    const forward = vec3.create();
    vec3.cross(forward, axis, right);

    // Generate base vertices
    const basePoints: vec3[] = [];
    for (let i = 0; i < segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      const x = Math.cos(angle) * baseRadius;
      const y = Math.sin(angle) * baseRadius;

      const point = vec3.clone(baseCenterGl);
      vec3.scaleAndAdd(point, point, right, x);
      vec3.scaleAndAdd(point, point, forward, y);

      basePoints.push(point);
    }

    // Base disk
    const baseNormal = vec3.clone(axis);
    vec3.scale(baseNormal, baseNormal, -1); // Pointing away from cone
    const baseNormalVec3 = fromGlVec3(baseNormal);

    for (let i = 0; i < segments; i++) {
      const p1 = fromGlVec3(basePoints[i]);
      const p2 = fromGlVec3(basePoints[(i + 1) % segments]);

      // Triangle fan for base
      this.addTriangle(baseCenter, p2, p1, baseNormalVec3, color);
    }

    // Sides
    for (let i = 0; i < segments; i++) {
      const p1Gl = basePoints[i];
      const p2Gl = basePoints[(i + 1) % segments];

      const p1 = fromGlVec3(p1Gl);
      const p2 = fromGlVec3(p2Gl);

      // Compute face normal
      const v1 = vec3.create();
      vec3.subtract(v1, p2Gl, p1Gl);
      const v2 = vec3.create();
      vec3.subtract(v2, apexGl, p1Gl);
      const normal = vec3.create();
      vec3.cross(normal, v1, v2);
      vec3.normalize(normal, normal);
      const normalVec3 = fromGlVec3(normal);

      this.addTriangle(p1, p2, apex, normalVec3, color);
    }
  }

  addTorus(
    center: Vec3,
    radius: number,
    tubeRadius: number,
    color: Color,
    axis: Vec3 = { x: 0, y: 0, z: 1 }
  ): void {
    const segments = 16;
    const tubeSegments = 8;

    // Compute orientation basis from axis
    const axisVec = toGlVec3(axis);
    vec3.normalize(axisVec, axisVec);

    const centerGl = toGlVec3(center);

    // Default Z axis
    const zAxis = vec3.fromValues(0, 0, 1);

    // Compute rotation matrix to align Z with axisVec
    const rotation = mat4.create();

    // If axis is parallel to Z, special case
    if (Math.abs(vec3.dot(axisVec, zAxis)) > 0.999) {
      if (axisVec[2] < 0) {
        mat4.rotateX(rotation, rotation, Math.PI); // Flip 180 if -Z
      }
      // else identity
    } else {
      const rotAxis = vec3.create();
      vec3.cross(rotAxis, zAxis, axisVec);
      vec3.normalize(rotAxis, rotAxis);
      const angle = Math.acos(vec3.dot(zAxis, axisVec));
      mat4.fromRotation(rotation, angle, rotAxis);
    }

    const vertices: vec3[][] = [];
    const normals: vec3[][] = [];

    for (let i = 0; i <= segments; i++) {
      const u = (i / segments) * Math.PI * 2;
      const cosU = Math.cos(u);
      const sinU = Math.sin(u);

      const ringVerts: vec3[] = [];
      const ringNorms: vec3[] = [];

      for (let j = 0; j <= tubeSegments; j++) {
        const v = (j / tubeSegments) * Math.PI * 2;
        const cosV = Math.cos(v);
        const sinV = Math.sin(v);

        // Local coords (Z-up)
        const cx = (radius + tubeRadius * cosV) * cosU;
        const cy = (radius + tubeRadius * cosV) * sinU;
        const cz = tubeRadius * sinV;

        const pt = vec3.fromValues(cx, cy, cz);

        // Normal
        const nx = cosV * cosU;
        const ny = cosV * sinU;
        const nz = sinV;
        const n = vec3.fromValues(nx, ny, nz);

        // Transform
        vec3.transformMat4(pt, pt, rotation);
        vec3.transformMat4(n, n, rotation);

        vec3.add(pt, pt, centerGl); // Translate to center

        ringVerts.push(pt);
        ringNorms.push(n);
      }
      vertices.push(ringVerts);
      normals.push(ringNorms);
    }

    for (let i = 0; i < segments; i++) {
      for (let j = 0; j < tubeSegments; j++) {
        const p1 = vertices[i][j];
        const p2 = vertices[i + 1][j];
        const p3 = vertices[i + 1][j + 1];
        const p4 = vertices[i][j + 1];

        const p1V = fromGlVec3(p1);
        const p2V = fromGlVec3(p2);
        const p3V = fromGlVec3(p3);
        const p4V = fromGlVec3(p4);

        // Compute face normal for better flat shading
        const v1 = vec3.create();
        vec3.subtract(v1, p2, p1);
        const v2 = vec3.create();
        vec3.subtract(v2, p3, p1);
        const faceN1 = vec3.create();
        vec3.cross(faceN1, v1, v2);
        vec3.normalize(faceN1, faceN1);

        this.addTriangle(p1V, p2V, p3V, fromGlVec3(faceN1), color);

        const v3 = vec3.create();
        vec3.subtract(v3, p3, p1);
        const v4 = vec3.create();
        vec3.subtract(v4, p4, p1);
        const faceN2 = vec3.create();
        vec3.cross(faceN2, v3, v4);
        vec3.normalize(faceN2, faceN2);

        this.addTriangle(p1V, p3V, p4V, fromGlVec3(faceN2), color);
      }
    }
  }

  // =========================================================================
  // Rendering
  // =========================================================================

  render(
    pass: GPURenderPassEncoder,
    viewProjection: Float32Array,
    alwaysOnTop: boolean = false
  ): void {
    // Update line uniforms
    if (this.lineVertices.length > 0) {
      this.lineUniformBuffer.write(viewProjection as BufferSource);

      // Upload vertex data
      this.lineVertexBuffer.write(new Float32Array(this.lineVertices) as BufferSource);

      // Render lines
      if (alwaysOnTop) {
        // For always-on-top rendering, we could disable depth testing
        // but WebGPU doesn't allow changing depth state per draw call
        // This would need to be handled at the pipeline level
      }

      pass.setPipeline(this.linePipeline.pipeline);
      pass.setBindGroup(0, this.lineBindGroup.bindGroup);
      pass.setVertexBuffer(0, this.lineVertexBuffer.buffer);
      pass.draw(this.lineVertices.length / 6, 1, 0, 0);
    }

    // Update solid uniforms
    if (this.solidVertices.length > 0) {
      // Create uniform data: viewProjection matrix + lighting flag
      const uniformData = new Float32Array(20); // 64 bytes for matrix + 4 bytes for flag + padding
      uniformData.set(viewProjection, 0);

      // Set lighting flag (as float32 since we're using Float32Array)
      // In the shader it's read as u32, but the layout works the same
      const lightingEnabled = new Uint32Array(uniformData.buffer, 64, 1);
      lightingEnabled[0] = 1; // Enable lighting

      this.solidUniformBuffer.write(uniformData as BufferSource);

      // Upload vertex data
      this.solidVertexBuffer.write(new Float32Array(this.solidVertices) as BufferSource);

      // Render solid geometry
      pass.setPipeline(this.solidPipeline.pipeline);
      pass.setBindGroup(0, this.solidBindGroup.bindGroup);
      pass.setVertexBuffer(0, this.solidVertexBuffer.buffer);
      pass.draw(this.solidVertices.length / 9, 1, 0, 0);
    }
  }

  // Get labels for external rendering (e.g., by renderer using drawString)
  getLabels(viewProjection: Float32Array, width: number, height: number): { text: string; x: number; y: number }[] {
    const results: { text: string; x: number; y: number }[] = [];

    for (const label of this.labels) {
      const v = vec4.fromValues(label.position.x, label.position.y, label.position.z, 1.0);
      const clip = vec4.create();

      // Manual matrix-vector multiplication
      const vp = viewProjection;
      const x = v[0], y = v[1], z = v[2], w = v[3];
      clip[0] = vp[0] * x + vp[4] * y + vp[8] * z + vp[12] * w;
      clip[1] = vp[1] * x + vp[5] * y + vp[9] * z + vp[13] * w;
      clip[2] = vp[2] * x + vp[6] * y + vp[10] * z + vp[14] * w;
      clip[3] = vp[3] * x + vp[7] * y + vp[11] * z + vp[15] * w;

      if (clip[3] > 0) {
        // In front of camera
        const ndcX = clip[0] / clip[3];
        const ndcY = clip[1] / clip[3];

        // Map NDC to viewport
        const screenX = (ndcX + 1) * 0.5 * width;
        const screenY = (1 - ndcY) * 0.5 * height; // Flip Y

        // Simple bounds check
        if (screenX >= 0 && screenX <= width && screenY >= 0 && screenY <= height) {
          results.push({ text: label.text, x: screenX, y: screenY });
        }
      }
    }
    return results;
  }

  clear(): void {
    this.lineVertices = [];
    this.solidVertices = [];
    this.labels = [];
  }

  destroy(): void {
    this.linePipeline.destroy();
    this.solidPipeline.destroy();
    this.lineVertexBuffer.destroy();
    this.solidVertexBuffer.destroy();
    this.lineUniformBuffer.destroy();
    this.solidUniformBuffer.destroy();
    this.lineBindGroup.destroy();
    this.solidBindGroup.destroy();
  }
}
