import { vi } from 'vitest';

interface ShaderRecord {
  readonly id: number;
  readonly type: GLenum;
}

interface ProgramRecord {
  readonly id: number;
}

export class MockWebGL2RenderingContext {
  readonly ARRAY_BUFFER = 0x8892;
  readonly ELEMENT_ARRAY_BUFFER = 0x8893;
  readonly STATIC_DRAW = 0x88e4;
  readonly DYNAMIC_DRAW = 0x88e8;
  readonly FLOAT = 0x1406;
  readonly UNSIGNED_SHORT = 0x1403;
  readonly TEXTURE_2D = 0x0de1;
  readonly TEXTURE_CUBE_MAP = 0x8513;
  readonly TEXTURE_CUBE_MAP_POSITIVE_X = 0x8515;
  readonly TEXTURE0 = 0x84c0;
  readonly TEXTURE_WRAP_S = 0x2802;
  readonly TEXTURE_WRAP_T = 0x2803;
  readonly TEXTURE_MIN_FILTER = 0x2801;
  readonly TEXTURE_MAG_FILTER = 0x2800;
  readonly LINEAR = 0x2601;
  readonly NEAREST = 0x2600;
  readonly CLAMP_TO_EDGE = 0x812f;
  readonly RGBA = 0x1908;
  readonly UNSIGNED_BYTE = 0x1401;
  readonly FRAMEBUFFER = 0x8d40;
  readonly COLOR_ATTACHMENT0 = 0x8ce0;
  readonly DEPTH_ATTACHMENT = 0x8d00;
  readonly TRIANGLES = 0x0004;
  readonly DEPTH_TEST = 0x0b71;
  readonly CULL_FACE = 0x0b44;
  readonly BLEND = 0x0be2;
  readonly SRC_ALPHA = 0x0302;
  readonly ONE_MINUS_SRC_ALPHA = 0x0303;
  readonly ONE = 1;
  readonly BACK = 0x0405;
  readonly LEQUAL = 0x0203;
  readonly VERTEX_SHADER = 0x8b31;
  readonly FRAGMENT_SHADER = 0x8b30;
  readonly COMPILE_STATUS = 0x8b81;
  readonly LINK_STATUS = 0x8b82;
  readonly ONE_MINUS_SRC_COLOR = 0x0301;

  private shaderCounter = 0;
  private programCounter = 0;

  compileSucceeds = true;
  linkSucceeds = true;
  shaderInfoLog = 'shader failed';
  programInfoLog = 'program failed';

  readonly extensions = new Map<string, unknown>();
  readonly calls: string[] = [];
  readonly uniformLocations = new Map<string, WebGLUniformLocation | null>();
  readonly attributeLocations = new Map<string, number>();

  enable = vi.fn((cap: GLenum) => this.calls.push(`enable:${cap}`));
  disable = vi.fn((cap: GLenum) => this.calls.push(`disable:${cap}`));
  depthFunc = vi.fn((func: GLenum) => this.calls.push(`depthFunc:${func}`));
  cullFace = vi.fn((mode: GLenum) => this.calls.push(`cullFace:${mode}`));
  depthMask = vi.fn((flag: GLboolean) => this.calls.push(`depthMask:${flag}`));
  blendFuncSeparate = vi.fn((srcRGB: GLenum, dstRGB: GLenum, srcAlpha: GLenum, dstAlpha: GLenum) =>
    this.calls.push(`blendFuncSeparate:${srcRGB}:${dstRGB}:${srcAlpha}:${dstAlpha}`)
  );
  blendFunc = vi.fn((sfactor: GLenum, dfactor: GLenum) => this.calls.push(`blendFunc:${sfactor}:${dfactor}`));
  getExtension = vi.fn((name: string) => this.extensions.get(name) ?? null);

  createShader = vi.fn((type: GLenum) => ({ id: ++this.shaderCounter, type } as unknown as WebGLShader));
  shaderSource = vi.fn((shader: ShaderRecord, source: string) => this.calls.push(`shaderSource:${shader.id}:${source}`));
  compileShader = vi.fn((shader: ShaderRecord) => this.calls.push(`compileShader:${shader.id}`));
  getShaderParameter = vi.fn((shader: ShaderRecord, pname: GLenum) =>
    pname === this.COMPILE_STATUS ? this.compileSucceeds : null
  );
  getShaderInfoLog = vi.fn(() => (this.compileSucceeds ? '' : this.shaderInfoLog));
  deleteShader = vi.fn((shader: ShaderRecord) => this.calls.push(`deleteShader:${shader.id}`));

  createProgram = vi.fn(() => ({ id: ++this.programCounter } as unknown as WebGLProgram));
  attachShader = vi.fn((program: ProgramRecord, shader: ShaderRecord) =>
    this.calls.push(`attach:${program.id}:${shader.id}`)
  );
  bindAttribLocation = vi.fn((program: ProgramRecord, index: number, name: string) =>
    this.calls.push(`bindAttribLocation:${program.id}:${index}:${name}`)
  );
  linkProgram = vi.fn((program: ProgramRecord) => this.calls.push(`link:${program.id}`));
  getProgramParameter = vi.fn((program: ProgramRecord, pname: GLenum) =>
    pname === this.LINK_STATUS ? this.linkSucceeds : null
  );
  getProgramInfoLog = vi.fn(() => (this.linkSucceeds ? '' : this.programInfoLog));
  deleteProgram = vi.fn((program: ProgramRecord) => this.calls.push(`deleteProgram:${program.id}`));
  useProgram = vi.fn((program: ProgramRecord | null) => this.calls.push(`useProgram:${program?.id ?? 'null'}`));
  getUniformLocation = vi.fn((program: ProgramRecord, name: string) => {
    this.calls.push(`getUniformLocation:${program.id}:${name}`);
    return this.uniformLocations.get(name) ?? null;
  });
  getAttribLocation = vi.fn((program: ProgramRecord, name: string) => {
    this.calls.push(`getAttribLocation:${program.id}:${name}`);
    return this.attributeLocations.get(name) ?? -1;
  });

  createBuffer = vi.fn(() => ({ buffer: {} } as unknown as WebGLBuffer));
  bindBuffer = vi.fn((target: GLenum, buffer: WebGLBuffer | null) => this.calls.push(`bindBuffer:${target}:${!!buffer}`));
  bufferData = vi.fn((target: GLenum, data: number | BufferSource, usage: GLenum) =>
    this.calls.push(`bufferData:${target}:${usage}:${typeof data === 'number' ? data : 'data'}`)
  );
  bufferSubData = vi.fn((target: GLenum, offset: number, data: BufferSource) =>
    this.calls.push(`bufferSubData:${target}:${offset}:${data.byteLength ?? 'len'}`)
  );
  deleteBuffer = vi.fn((buffer: WebGLBuffer) => this.calls.push(`deleteBuffer:${!!buffer}`));

  createVertexArray = vi.fn(() => ({ vao: {} } as unknown as WebGLVertexArrayObject));
  bindVertexArray = vi.fn((vao: WebGLVertexArrayObject | null) => this.calls.push(`bindVertexArray:${!!vao}`));
  enableVertexAttribArray = vi.fn((index: number) => this.calls.push(`enableAttrib:${index}`));
  vertexAttribPointer = vi.fn(
    (index: number, size: number, type: GLenum, normalized: boolean, stride: number, offset: number) =>
      this.calls.push(`vertexAttribPointer:${index}:${size}:${type}:${normalized}:${stride}:${offset}`)
  );
  vertexAttribDivisor = vi.fn((index: number, divisor: number) => this.calls.push(`divisor:${index}:${divisor}`));
  deleteVertexArray = vi.fn((vao: WebGLVertexArrayObject) => this.calls.push(`deleteVertexArray:${!!vao}`));

  createTexture = vi.fn(() => ({ texture: {} } as unknown as WebGLTexture));
  activeTexture = vi.fn((unit: GLenum) => this.calls.push(`activeTexture:${unit}`));
  bindTexture = vi.fn((target: GLenum, texture: WebGLTexture | null) => this.calls.push(`bindTexture:${target}:${!!texture}`));
  texParameteri = vi.fn((target: GLenum, pname: GLenum, param: GLint) =>
    this.calls.push(`texParameteri:${target}:${pname}:${param}`)
  );
  texImage2D = vi.fn(
    (
      target: GLenum,
      level: GLint,
      internalFormat: GLenum,
      width: GLsizei,
      height: GLsizei,
      border: GLint,
      format: GLenum,
      type: GLenum,
      pixels: ArrayBufferView | null
    ) =>
      this.calls.push(
        `texImage2D:${target}:${level}:${internalFormat}:${width}:${height}:${border}:${format}:${type}:${pixels ? 'data' : 'null'}`
      )
  );
  deleteTexture = vi.fn((texture: WebGLTexture) => this.calls.push(`deleteTexture:${!!texture}`));

  createFramebuffer = vi.fn(() => ({ fb: {} } as unknown as WebGLFramebuffer));
  bindFramebuffer = vi.fn((target: GLenum, framebuffer: WebGLFramebuffer | null) =>
    this.calls.push(`bindFramebuffer:${target}:${!!framebuffer}`)
  );
  framebufferTexture2D = vi.fn(
    (target: GLenum, attachment: GLenum, textarget: GLenum, texture: WebGLTexture | null, level: GLint) =>
      this.calls.push(`framebufferTexture2D:${target}:${attachment}:${textarget}:${!!texture}:${level}`)
  );
  deleteFramebuffer = vi.fn((fb: WebGLFramebuffer) => this.calls.push(`deleteFramebuffer:${!!fb}`));

  drawArrays = vi.fn((mode: GLenum, first: GLint, count: GLsizei) =>
    this.calls.push(`drawArrays:${mode}:${first}:${count}`)
  );

  drawElements = vi.fn((mode: GLenum, count: GLsizei, type: GLenum, offset: GLintptr) =>
    this.calls.push(`drawElements:${mode}:${count}:${type}:${offset}`)
  );

  uniform1f = vi.fn((location: WebGLUniformLocation | null, x: GLfloat) =>
    this.calls.push(`uniform1f:${location ? 'set' : 'null'}:${x}`)
  );
  uniform1i = vi.fn((location: WebGLUniformLocation | null, x: GLint) =>
    this.calls.push(`uniform1i:${location ? 'set' : 'null'}:${x}`)
  );
  uniform3fv = vi.fn((location: WebGLUniformLocation | null, data: Float32List | number[]) =>
    this.calls.push(`uniform3fv:${location ? 'set' : 'null'}:${Array.from(data as Iterable<number>).join(',')}`)
  );
  uniform2f = vi.fn((location: WebGLUniformLocation | null, x: GLfloat, y: GLfloat) =>
    this.calls.push(`uniform2f:${location ? 'set' : 'null'}:${x}:${y}`)
  );
  uniform4fv = vi.fn((location: WebGLUniformLocation | null, data: Float32List) =>
    this.calls.push(`uniform4fv:${location ? 'set' : 'null'}:${Array.from(data as Iterable<number>).join(',')}`)
  );
  uniformMatrix4fv = vi.fn(
    (location: WebGLUniformLocation | null, transpose: GLboolean, data: Float32List | Iterable<number>) =>
      this.calls.push(`uniformMatrix4fv:${location ? 'set' : 'null'}:${transpose}:${Array.from(data as Iterable<number>).join(',')}`)
  );

  isContextLost = vi.fn(() => false);
}

export function createMockWebGL2Context(overrides?: Partial<WebGL2RenderingContext>): MockWebGL2RenderingContext {
  const mock = new MockWebGL2RenderingContext();
  if (overrides) {
    Object.assign(mock, overrides);
  }
  return mock;
}
