export interface ShaderSources {
  readonly vertex: string;
  readonly fragment: string;
}

function compileShader(gl: WebGL2RenderingContext, type: GLenum, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) {
    throw new Error('Failed to allocate shader');
  }

  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  const ok = gl.getShaderParameter(shader, gl.COMPILE_STATUS) as boolean;
  if (!ok) {
    const log = gl.getShaderInfoLog(shader) ?? 'Unknown shader compile failure';
    gl.deleteShader(shader);
    throw new Error(log);
  }

  return shader;
}

function linkProgram(
  gl: WebGL2RenderingContext,
  vertexShader: WebGLShader,
  fragmentShader: WebGLShader,
  attributeLocations?: Record<string, number>
): WebGLProgram {
  const program = gl.createProgram();
  if (!program) {
    throw new Error('Failed to allocate shader program');
  }

  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);

  if (attributeLocations) {
    for (const [name, location] of Object.entries(attributeLocations)) {
      gl.bindAttribLocation(program, location, name);
    }
  }

  gl.linkProgram(program);
  const ok = gl.getProgramParameter(program, gl.LINK_STATUS) as boolean;
  if (!ok) {
    const log = gl.getProgramInfoLog(program) ?? 'Unknown shader link failure';
    gl.deleteProgram(program);
    throw new Error(log);
  }

  return program;
}

export class ShaderProgram {
  readonly gl: WebGL2RenderingContext;
  readonly program: WebGLProgram;
  private readonly uniformLocations = new Map<string, WebGLUniformLocation | null>();
  private readonly attributeLocations = new Map<string, number>();

  readonly sourceSize: number;

  private constructor(gl: WebGL2RenderingContext, program: WebGLProgram, sourceSize: number) {
    this.gl = gl;
    this.program = program;
    this.sourceSize = sourceSize;
  }

  static create(
    gl: WebGL2RenderingContext,
    sources: ShaderSources,
    attributeLocations?: Record<string, number>
  ): ShaderProgram {
    const vertexShader = compileShader(gl, gl.VERTEX_SHADER, sources.vertex);
    const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, sources.fragment);
    try {
      const program = linkProgram(gl, vertexShader, fragmentShader, attributeLocations);
      const sourceSize = sources.vertex.length + sources.fragment.length;
      return new ShaderProgram(gl, program, sourceSize);
    } finally {
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
    }
  }

  use(): void {
    this.gl.useProgram(this.program);
  }

  getUniformLocation(name: string): WebGLUniformLocation | null {
    if (!this.uniformLocations.has(name)) {
      const location = this.gl.getUniformLocation(this.program, name);
      this.uniformLocations.set(name, location);
    }

    return this.uniformLocations.get(name) ?? null;
  }

  getAttributeLocation(name: string): number {
    if (!this.attributeLocations.has(name)) {
      const location = this.gl.getAttribLocation(this.program, name);
      this.attributeLocations.set(name, location);
    }

    return this.attributeLocations.get(name) ?? -1;
  }

  dispose(): void {
    this.gl.deleteProgram(this.program);
    this.uniformLocations.clear();
    this.attributeLocations.clear();
  }
}

export function createProgramFromSources(
  gl: WebGL2RenderingContext,
  sources: ShaderSources,
  attributeLocations?: Record<string, number>
): ShaderProgram {
  return ShaderProgram.create(gl, sources, attributeLocations);
}
