
export function createMockWebGL2Context(canvas: HTMLCanvasElement): WebGL2RenderingContext {
    const gl = {
        canvas,
        drawingBufferWidth: canvas.width,
        drawingBufferHeight: canvas.height,

        // Constants
        VERTEX_SHADER: 0x8B31,
        FRAGMENT_SHADER: 0x8B30,
        COMPILE_STATUS: 0x8B81,
        LINK_STATUS: 0x8B82,
        ARRAY_BUFFER: 0x8892,
        ELEMENT_ARRAY_BUFFER: 0x8893,
        STATIC_DRAW: 0x88E4,
        DYNAMIC_DRAW: 0x88E8,
        FLOAT: 0x1406,
        DEPTH_TEST: 0x0B71,
        BLEND: 0x0BE2,
        SRC_ALPHA: 0x0302,
        ONE_MINUS_SRC_ALPHA: 0x0303,
        TEXTURE_2D: 0x0DE1,
        RGBA: 0x1908,
        UNSIGNED_BYTE: 0x1401,
        COLOR_BUFFER_BIT: 0x4000,
        DEPTH_BUFFER_BIT: 0x0100,
        TRIANGLES: 0x0004,
        TRIANGLE_STRIP: 0x0005,
        TRIANGLE_FAN: 0x0006,

        // Methods
        createShader: () => ({}),
        shaderSource: () => {},
        compileShader: () => {},
        getShaderParameter: (_: any, param: number) => {
            if (param === 0x8B81) return true; // COMPILE_STATUS
            return true;
        },
        getShaderInfoLog: () => '',
        createProgram: () => ({}),
        attachShader: () => {},
        linkProgram: () => {},
        getProgramParameter: (_: any, param: number) => {
            if (param === 0x8B82) return true; // LINK_STATUS
            return true;
        },
        getProgramInfoLog: () => '',
        useProgram: () => {},
        createBuffer: () => ({}),
        bindBuffer: () => {},
        bufferData: () => {},
        enableVertexAttribArray: () => {},
        vertexAttribPointer: () => {},
        enable: () => {},
        disable: () => {},
        depthMask: () => {},
        blendFunc: () => {},
        viewport: () => {},
        clearColor: () => {},
        clear: () => {},
        createTexture: () => ({}),
        bindTexture: () => {},
        texImage2D: () => {},
        texParameteri: () => {},
        activeTexture: () => {},
        uniform1i: () => {},
        uniform1f: () => {},
        uniform2f: () => {},
        uniform3f: () => {},
        uniform4f: () => {},
        uniformMatrix4fv: () => {},
        getUniformLocation: () => ({}),
        getAttribLocation: () => 0,
        drawArrays: () => {},
        drawElements: () => {},
        createVertexArray: () => ({}),
        bindVertexArray: () => {},
        deleteShader: () => {},
        deleteProgram: () => {},
        deleteBuffer: () => {},
        deleteTexture: () => {},
        deleteVertexArray: () => {},

        // WebGL2 specific
        texImage3D: () => {},
        uniformBlockBinding: () => {},
        getExtension: () => null,
    } as unknown as WebGL2RenderingContext;

    return gl;
}
