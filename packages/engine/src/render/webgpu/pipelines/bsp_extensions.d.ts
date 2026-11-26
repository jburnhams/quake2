
// Extend BspSurfaceGeometry to include WebGPU buffers
declare module '../../bsp.js' {
    interface BspSurfaceGeometry {
        gpuVertexBuffer?: GPUBuffer;
        gpuIndexBuffer?: GPUBuffer;
        gpuWireframeIndexBuffer?: GPUBuffer;
        gpuWireframeIndexCount?: number;
    }
}
