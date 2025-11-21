export type BufferUsage = GLenum;

export interface VertexAttributeLayout {
  readonly index: number;
  readonly size: number;
  readonly type: GLenum;
  readonly normalized?: boolean;
  readonly stride?: number;
  readonly offset?: number;
  readonly divisor?: number;
}

export class VertexBuffer {
  readonly gl: WebGL2RenderingContext;
  readonly buffer: WebGLBuffer;
  readonly target: GLenum;

  constructor(gl: WebGL2RenderingContext, usage: BufferUsage = gl.STATIC_DRAW, target?: GLenum) {
    this.gl = gl;
    this.target = target ?? gl.ARRAY_BUFFER;
    const buffer = gl.createBuffer();
    if (!buffer) {
      throw new Error('Failed to allocate buffer');
    }
    this.buffer = buffer;
    gl.bindBuffer(this.target, this.buffer);
    gl.bufferData(this.target, 0, usage);
  }

  bind(): void {
    this.gl.bindBuffer(this.target, this.buffer);
  }

  upload(data: BufferSource, usage: BufferUsage = this.gl.STATIC_DRAW): void {
    this.bind();
    this.gl.bufferData(this.target, data, usage);
  }

  update(data: BufferSource, offset = 0): void {
    this.bind();
    this.gl.bufferSubData(this.target, offset, data);
  }

  dispose(): void {
    this.gl.deleteBuffer(this.buffer);
  }
}

export class IndexBuffer extends VertexBuffer {
  constructor(gl: WebGL2RenderingContext, usage: BufferUsage = gl.STATIC_DRAW) {
    super(gl, usage, gl.ELEMENT_ARRAY_BUFFER);
  }
}

export class VertexArray {
  readonly gl: WebGL2RenderingContext;
  readonly vao: WebGLVertexArrayObject;

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
    const vao = gl.createVertexArray();
    if (!vao) {
      throw new Error('Failed to allocate vertex array object');
    }
    this.vao = vao;
  }

  bind(): void {
    this.gl.bindVertexArray(this.vao);
  }

  configureAttributes(layouts: readonly VertexAttributeLayout[], buffer?: VertexBuffer): void {
    this.bind();
    if (buffer) {
      buffer.bind();
    }

    for (const layout of layouts) {
      this.gl.enableVertexAttribArray(layout.index);
      this.gl.vertexAttribPointer(
        layout.index,
        layout.size,
        layout.type,
        layout.normalized ?? false,
        layout.stride ?? 0,
        layout.offset ?? 0
      );
      if (layout.divisor !== undefined) {
        this.gl.vertexAttribDivisor(layout.index, layout.divisor);
      }
    }
  }

  dispose(): void {
    this.gl.deleteVertexArray(this.vao);
  }
}

export interface TextureParameters {
  readonly wrapS?: GLenum;
  readonly wrapT?: GLenum;
  readonly minFilter?: GLenum;
  readonly magFilter?: GLenum;
}

export class Texture2D {
  readonly gl: WebGL2RenderingContext;
  readonly texture: WebGLTexture;
  readonly target: GLenum;

  width = 0;
  height = 0;

  constructor(gl: WebGL2RenderingContext, target: GLenum = gl.TEXTURE_2D) {
    this.gl = gl;
    this.target = target;
    const texture = gl.createTexture();
    if (!texture) {
      throw new Error('Failed to allocate texture');
    }
    this.texture = texture;
  }

  bind(unit = 0): void {
    this.gl.activeTexture(this.gl.TEXTURE0 + unit);
    this.gl.bindTexture(this.target, this.texture);
  }

  setParameters(params: TextureParameters): void {
    this.bind();
    if (params.wrapS !== undefined) {
      this.gl.texParameteri(this.target, this.gl.TEXTURE_WRAP_S, params.wrapS);
    }
    if (params.wrapT !== undefined) {
      this.gl.texParameteri(this.target, this.gl.TEXTURE_WRAP_T, params.wrapT);
    }
    if (params.minFilter !== undefined) {
      this.gl.texParameteri(this.target, this.gl.TEXTURE_MIN_FILTER, params.minFilter);
    }
    if (params.magFilter !== undefined) {
      this.gl.texParameteri(this.target, this.gl.TEXTURE_MAG_FILTER, params.magFilter);
    }
  }

  upload(width: number, height: number, data: TexImageSource | ArrayBufferView | null) {
      this.width = width;
      this.height = height;
      this.uploadImage(0, this.gl.RGBA, width, height, 0, this.gl.RGBA, this.gl.UNSIGNED_BYTE, data);
  }

  uploadImage(
    level: number,
    internalFormat: GLenum,
    width: number,
    height: number,
    border: number,
    format: GLenum,
    type: GLenum,
    data: TexImageSource | ArrayBufferView | null
  ): void {
    this.bind();
    this.gl.texImage2D(this.target, level, internalFormat, width, height, border, format, type, data as any);
  }

  dispose(): void {
    this.gl.deleteTexture(this.texture);
  }
}

export class TextureCubeMap {
  readonly gl: WebGL2RenderingContext;
  readonly texture: WebGLTexture;
  readonly target: GLenum;

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
    this.target = gl.TEXTURE_CUBE_MAP;
    const texture = gl.createTexture();
    if (!texture) {
      throw new Error('Failed to allocate cubemap texture');
    }
    this.texture = texture;
  }

  bind(unit = 0): void {
    this.gl.activeTexture(this.gl.TEXTURE0 + unit);
    this.gl.bindTexture(this.target, this.texture);
  }

  setParameters(params: TextureParameters): void {
    this.bind();
    if (params.wrapS !== undefined) {
      this.gl.texParameteri(this.target, this.gl.TEXTURE_WRAP_S, params.wrapS);
    }
    if (params.wrapT !== undefined) {
      this.gl.texParameteri(this.target, this.gl.TEXTURE_WRAP_T, params.wrapT);
    }
    if (params.minFilter !== undefined) {
      this.gl.texParameteri(this.target, this.gl.TEXTURE_MIN_FILTER, params.minFilter);
    }
    if (params.magFilter !== undefined) {
      this.gl.texParameteri(this.target, this.gl.TEXTURE_MAG_FILTER, params.magFilter);
    }
  }

  uploadFace(
    faceTarget: GLenum,
    level: number,
    internalFormat: GLenum,
    width: number,
    height: number,
    border: number,
    format: GLenum,
    type: GLenum,
    data: ArrayBufferView | null
  ): void {
    this.bind();
    this.gl.texImage2D(faceTarget, level, internalFormat, width, height, border, format, type, data);
  }

  dispose(): void {
    this.gl.deleteTexture(this.texture);
  }
}

export class Framebuffer {
  readonly gl: WebGL2RenderingContext;
  readonly framebuffer: WebGLFramebuffer;

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
    const framebuffer = gl.createFramebuffer();
    if (!framebuffer) {
      throw new Error('Failed to allocate framebuffer');
    }
    this.framebuffer = framebuffer;
  }

  bind(target: GLenum = this.gl.FRAMEBUFFER): void {
    this.gl.bindFramebuffer(target, this.framebuffer);
  }

  attachTexture2D(attachment: GLenum, texture: Texture2D, level = 0): void {
    this.bind();
    this.gl.framebufferTexture2D(this.gl.FRAMEBUFFER, attachment, texture.target, texture.texture, level);
  }

  dispose(): void {
    this.gl.deleteFramebuffer(this.framebuffer);
  }
}
