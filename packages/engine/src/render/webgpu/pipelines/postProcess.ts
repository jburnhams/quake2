import postProcessShader from '../shaders/postProcess.wgsl?raw';

export interface PostProcessOptions {
    readonly time: number;
    readonly strength: number;
    readonly gamma: number;
    readonly brightness: number;
}

export class PostProcessPipeline {
    private pipeline: GPURenderPipeline;
    private bindGroupLayout: GPUBindGroupLayout;
    private uniformBuffer: GPUBuffer;
    private device: GPUDevice;

    constructor(device: GPUDevice, format: GPUTextureFormat) {
        this.device = device;

        // Bind group layout
        this.bindGroupLayout = device.createBindGroupLayout({
            label: 'PostProcess BindGroupLayout',
            entries: [
                {
                    binding: 0,
                    visibility: GPUShaderStage.FRAGMENT,
                    texture: { sampleType: 'float' }
                },
                {
                    binding: 1,
                    visibility: GPUShaderStage.FRAGMENT,
                    sampler: { type: 'filtering' }
                },
                {
                    binding: 2,
                    visibility: GPUShaderStage.FRAGMENT,
                    buffer: { type: 'uniform' }
                }
            ]
        });

        const pipelineLayout = device.createPipelineLayout({
            label: 'PostProcess PipelineLayout',
            bindGroupLayouts: [this.bindGroupLayout]
        });

        const module = device.createShaderModule({
            label: 'PostProcess Shader',
            code: postProcessShader
        });

        this.pipeline = device.createRenderPipeline({
            label: 'PostProcess Pipeline',
            layout: pipelineLayout,
            vertex: {
                module,
                entryPoint: 'vertexMain'
            },
            fragment: {
                module,
                entryPoint: 'fragmentMain',
                targets: [{
                    format: format,
                    blend: {
                        color: {
                            srcFactor: 'src-alpha',
                            dstFactor: 'one-minus-src-alpha',
                            operation: 'add',
                        },
                        alpha: {
                            srcFactor: 'one',
                            dstFactor: 'one-minus-src-alpha',
                            operation: 'add',
                        },
                    }
                }]
            },
            primitive: {
                topology: 'triangle-strip',
                stripIndexFormat: 'uint16'
            }
        });

        // 4 floats: time, strength, gamma, brightness
        this.uniformBuffer = device.createBuffer({
            size: 4 * 4,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
            label: 'PostProcess Uniforms'
        });
    }

    render(
        passEncoder: GPURenderPassEncoder,
        sourceTexture: GPUTextureView,
        sampler: GPUSampler,
        options: PostProcessOptions
    ) {
        // Update uniforms
        const uniformData = new Float32Array([
            options.time,
            options.strength,
            options.gamma,
            options.brightness
        ]);
        this.device.queue.writeBuffer(this.uniformBuffer, 0, uniformData);

        const bindGroup = this.device.createBindGroup({
            layout: this.bindGroupLayout,
            entries: [
                { binding: 0, resource: sourceTexture },
                { binding: 1, resource: sampler },
                { binding: 2, resource: { buffer: this.uniformBuffer } }
            ]
        });

        passEncoder.setPipeline(this.pipeline);
        passEncoder.setBindGroup(0, bindGroup);
        passEncoder.draw(4);
    }

    destroy() {
        this.uniformBuffer.destroy();
    }
}
