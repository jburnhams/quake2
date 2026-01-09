import { WebGPUContext } from '../context.js';
import { Mat4, Vec3 } from '@quake2ts/shared';
import shaderSource from '../shaders/debug.wgsl?raw';
import { mat4, vec3, vec4 } from 'gl-matrix';

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
    private linePipeline: GPURenderPipeline;
    private solidPipeline: GPURenderPipeline;
    private bindGroupLayout: GPUBindGroupLayout;
    private uniformBuffer: GPUBuffer;
    private bindGroup: GPUBindGroup;

    private lineVertices: number[] = [];
    private solidVertices: number[] = [];
    private labels: TextLabel[] = [];

    private lineVertexBuffer: GPUBuffer | null = null;
    private solidVertexBuffer: GPUBuffer | null = null;

    // Limits
    private static MAX_LINE_VERTICES = 100000;
    private static MAX_SOLID_VERTICES = 100000;

    constructor(private context: WebGPUContext) {
        // Uniform Buffer
        this.uniformBuffer = context.device.createBuffer({
            size: 64, // mat4
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });

        // Bind Group Layout
        this.bindGroupLayout = context.device.createBindGroupLayout({
            entries: [{
                binding: 0,
                visibility: GPUShaderStage.VERTEX,
                buffer: { type: 'uniform' },
            }],
        });

        // Bind Group
        this.bindGroup = context.device.createBindGroup({
            layout: this.bindGroupLayout,
            entries: [{
                binding: 0,
                resource: { buffer: this.uniformBuffer },
            }],
        });

        // Shaders
        const module = context.device.createShaderModule({
            code: shaderSource,
        });

        // Line Pipeline
        this.linePipeline = context.device.createRenderPipeline({
            layout: context.device.createPipelineLayout({
                bindGroupLayouts: [this.bindGroupLayout],
            }),
            vertex: {
                module,
                entryPoint: 'lineVertexMain',
                buffers: [{
                    arrayStride: 24, // 3*4 pos + 3*4 color
                    attributes: [
                        { shaderLocation: 0, offset: 0, format: 'float32x3' }, // position
                        { shaderLocation: 1, offset: 12, format: 'float32x3' }, // color
                    ],
                }],
            },
            fragment: {
                module,
                entryPoint: 'lineFragmentMain',
                targets: [{
                    format: context.format,
                    blend: {
                        color: {
                            srcFactor: 'src-alpha',
                            dstFactor: 'one-minus-src-alpha',
                            operation: 'add',
                        },
                        alpha: {
                            srcFactor: 'one',
                            dstFactor: 'one',
                            operation: 'add',
                        }
                    },
                }],
            },
            primitive: {
                topology: 'line-list',
            },
            depthStencil: {
                depthWriteEnabled: true,
                depthCompare: 'less',
                format: 'depth24plus',
            },
        });

        // Solid Pipeline
        this.solidPipeline = context.device.createRenderPipeline({
            layout: context.device.createPipelineLayout({
                bindGroupLayouts: [this.bindGroupLayout],
            }),
            vertex: {
                module,
                entryPoint: 'solidVertexMain',
                buffers: [{
                    arrayStride: 36, // 3*4 pos + 3*4 color + 3*4 normal
                    attributes: [
                        { shaderLocation: 0, offset: 0, format: 'float32x3' }, // position
                        { shaderLocation: 1, offset: 12, format: 'float32x3' }, // color
                        { shaderLocation: 2, offset: 24, format: 'float32x3' }, // normal
                    ],
                }],
            },
            fragment: {
                module,
                entryPoint: 'solidFragmentMain',
                targets: [{
                    format: context.format,
                    blend: {
                         color: {
                            srcFactor: 'src-alpha',
                            dstFactor: 'one-minus-src-alpha',
                            operation: 'add',
                        },
                        alpha: {
                            srcFactor: 'one',
                            dstFactor: 'one',
                            operation: 'add',
                        }
                    },
                }],
            },
            primitive: {
                topology: 'triangle-list',
                cullMode: 'back',
            },
            depthStencil: {
                depthWriteEnabled: true,
                depthCompare: 'less',
                format: 'depth24plus',
            },
        });

        // Initial buffers
        this.lineVertexBuffer = context.device.createBuffer({
            size: DebugPipeline.MAX_LINE_VERTICES * 24,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        });

        this.solidVertexBuffer = context.device.createBuffer({
            size: DebugPipeline.MAX_SOLID_VERTICES * 36,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        });
    }

    drawLine(start: Vec3, end: Vec3, color: Color) {
        if (this.lineVertices.length / 6 >= DebugPipeline.MAX_LINE_VERTICES) return;
        this.lineVertices.push(
            start.x, start.y, start.z, color.r, color.g, color.b,
            end.x, end.y, end.z, color.r, color.g, color.b
        );
    }

    drawBoundingBox(mins: Vec3, maxs: Vec3, color: Color) {
        const { x: x1, y: y1, z: z1 } = mins;
        const { x: x2, y: y2, z: z2 } = maxs;

        // Bottom
        this.drawLine({ x: x1, y: y1, z: z1 }, { x: x2, y: y1, z: z1 }, color);
        this.drawLine({ x: x2, y: y1, z: z1 }, { x: x2, y: y2, z: z1 }, color);
        this.drawLine({ x: x2, y: y2, z: z1 }, { x: x1, y: y2, z: z1 }, color);
        this.drawLine({ x: x1, y: y2, z: z1 }, { x: x1, y: y1, z: z1 }, color);

        // Top
        this.drawLine({ x: x1, y: y1, z: z2 }, { x: x2, y: y1, z: z2 }, color);
        this.drawLine({ x: x2, y: y1, z: z2 }, { x: x2, y: y2, z: z2 }, color);
        this.drawLine({ x: x2, y: y2, z: z2 }, { x: x1, y: y2, z: z2 }, color);
        this.drawLine({ x: x1, y: y2, z: z2 }, { x: x1, y: y1, z: z2 }, color);

        // Pillars
        this.drawLine({ x: x1, y: y1, z: z1 }, { x: x1, y: y1, z: z2 }, color);
        this.drawLine({ x: x2, y: y1, z: z1 }, { x: x2, y: y1, z: z2 }, color);
        this.drawLine({ x: x2, y: y2, z: z1 }, { x: x2, y: y2, z: z2 }, color);
        this.drawLine({ x: x1, y: y2, z: z1 }, { x: x1, y: y2, z: z2 }, color);
    }

    drawPoint(position: Vec3, size: number, color: Color) {
        const s = size / 2;
        this.drawBoundingBox(
            { x: position.x - s, y: position.y - s, z: position.z - s },
            { x: position.x + s, y: position.y + s, z: position.z + s },
            color
        );
    }

    drawAxes(position: Vec3, size: number) {
        this.drawLine(position, { x: position.x + size, y: position.y, z: position.z }, { r: 1, g: 0, b: 0 }); // X - Red
        this.drawLine(position, { x: position.x, y: position.y + size, z: position.z }, { r: 0, g: 1, b: 0 }); // Y - Green
        this.drawLine(position, { x: position.x, y: position.y, z: position.z + size }, { r: 0, g: 0, b: 1 }); // Z - Blue
    }

    drawText3D(text: string, position: Vec3) {
        this.labels.push({ text, position });
    }

    private addTriangle(v1: Vec3, v2: Vec3, v3: Vec3, normal: Vec3, color: Color) {
         if (this.solidVertices.length / 9 >= DebugPipeline.MAX_SOLID_VERTICES) return;
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

    addCone(apex: Vec3, baseCenter: Vec3, baseRadius: number, color: Color) {
        const segments = 16;

        // Calculate axis and basis vectors using gl-matrix
        const apexGl = toGlVec3(apex);
        const baseCenterGl = toGlVec3(baseCenter);

        const axis = vec3.create();
        vec3.subtract(axis, apexGl, baseCenterGl);

        // const height = vec3.length(axis);
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

            // point = baseCenter + right * x + forward * y
            const point = vec3.clone(baseCenterGl);
            vec3.scaleAndAdd(point, point, right, x);
            vec3.scaleAndAdd(point, point, forward, y);

            basePoints.push(point);
        }

        // Base disk
        const baseNormal = vec3.clone(axis);
        vec3.scale(baseNormal, baseNormal, -1); // Pointing away from cone
        const baseNormalVec3 = fromGlVec3(baseNormal);

        const center = baseCenter; // Vec3

        for (let i = 0; i < segments; i++) {
            const p1 = fromGlVec3(basePoints[i]);
            const p2 = fromGlVec3(basePoints[(i + 1) % segments]);

            // Triangle fan for base
            this.addTriangle(center, p2, p1, baseNormalVec3, color);
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

    addTorus(center: Vec3, radius: number, tubeRadius: number, color: Color, axis: Vec3 = {x: 0, y: 0, z: 1}) {
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
        // const normals: vec3[][] = []; // Not used?

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
            // normals.push(ringNorms);
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

                // Let's use computed face normal for better flat shading look
                const v1 = vec3.create(); vec3.subtract(v1, p2, p1);
                const v2 = vec3.create(); vec3.subtract(v2, p3, p1);
                const faceN1 = vec3.create();
                vec3.cross(faceN1, v1, v2);
                vec3.normalize(faceN1, faceN1);

                this.addTriangle(p1V, p2V, p3V, fromGlVec3(faceN1), color);

                const v3 = vec3.create(); vec3.subtract(v3, p3, p1);
                const v4 = vec3.create(); vec3.subtract(v4, p4, p1);
                const faceN2 = vec3.create();
                vec3.cross(faceN2, v3, v4);
                vec3.normalize(faceN2, faceN2);

                this.addTriangle(p1V, p3V, p4V, fromGlVec3(faceN2), color);
            }
        }
    }

    render(passEncoder: GPURenderPassEncoder, viewProjection: Float32Array) {
        // Update Uniforms
        this.context.device.queue.writeBuffer(
            this.uniformBuffer,
            0,
            viewProjection.buffer,
            viewProjection.byteOffset,
            viewProjection.byteLength
        );

        // Upload and Draw Lines
        if (this.lineVertices.length > 0 && this.lineVertexBuffer) {
            this.context.device.queue.writeBuffer(
                this.lineVertexBuffer,
                0,
                new Float32Array(this.lineVertices)
            );

            passEncoder.setPipeline(this.linePipeline);
            passEncoder.setBindGroup(0, this.bindGroup);
            passEncoder.setVertexBuffer(0, this.lineVertexBuffer);
            passEncoder.draw(this.lineVertices.length / 6, 1, 0, 0);
        }

        // Upload and Draw Solids
        if (this.solidVertices.length > 0 && this.solidVertexBuffer) {
            this.context.device.queue.writeBuffer(
                this.solidVertexBuffer,
                0,
                new Float32Array(this.solidVertices)
            );

            passEncoder.setPipeline(this.solidPipeline);
            passEncoder.setBindGroup(0, this.bindGroup);
            passEncoder.setVertexBuffer(0, this.solidVertexBuffer);
            passEncoder.draw(this.solidVertices.length / 9, 1, 0, 0);
        }
    }

    getLabels(viewProjection: Float32Array, width: number, height: number): { text: string, x: number, y: number }[] {
         const results: { text: string, x: number, y: number }[] = [];

         for (const label of this.labels) {
             const v = vec4.fromValues(label.position.x, label.position.y, label.position.z, 1.0);
             const clip = vec4.create();
             // Assuming viewProjection is compatible with gl-matrix vec4.transformMat4
             // But viewProjection here is Float32Array (16 elements).
             // We can map it.
             const vp = viewProjection as unknown as [number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number];

             // Manually transform or use gl-matrix
             // transformMat4(out, a, m)
             // m is mat4
             const m = vp;
             const x = v[0], y = v[1], z = v[2], w = v[3];
             clip[0] = m[0] * x + m[4] * y + m[8] * z + m[12] * w;
             clip[1] = m[1] * x + m[5] * y + m[9] * z + m[13] * w;
             clip[2] = m[2] * x + m[6] * y + m[10] * z + m[14] * w;
             clip[3] = m[3] * x + m[7] * y + m[11] * z + m[15] * w;

             if (clip[3] > 0) { // In front of camera
                 const ndcX = clip[0] / clip[3];
                 const ndcY = clip[1] / clip[3];

                 // Map NDC to viewport
                 // x: [-1, 1] -> [0, width]
                 // y: [-1, 1] -> [height, 0] (since canvas y is down, but GL y is up. Wait, GL NDC y is up, Canvas y is down.)

                 const screenX = (ndcX + 1) * 0.5 * width;
                 const screenY = (1 - ndcY) * 0.5 * height; // Flip Y

                 // Simple bounds check?
                 if (screenX >= 0 && screenX <= width && screenY >= 0 && screenY <= height) {
                     results.push({ text: label.text, x: screenX, y: screenY });
                 }
             }
         }
         return results;
    }

    clear() {
        this.lineVertices = [];
        this.solidVertices = [];
        this.labels = [];
    }
}
