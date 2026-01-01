import { describe, expect, it } from 'vitest';
import { createProgramFromSources, ShaderProgram } from '../../../src/render/shaderProgram.js';
import { createMockWebGL2Context } from '@quake2ts/test-utils';

const basicVertex = `#version 300 es
in vec3 position;
void main() { gl_Position = vec4(position, 1.0); }`;
const basicFragment = `#version 300 es
precision highp float;
out vec4 color;
void main() { color = vec4(1.0); }`;

describe('ShaderProgram', () => {
  it('compiles, links, and caches uniform/attribute lookups', () => {
    const gl = createMockWebGL2Context();
    gl.uniformLocations.set('u_mvp', {} as WebGLUniformLocation);
    gl.attributeLocations.set('a_position', 3);

    const program = createProgramFromSources(
      gl as unknown as WebGL2RenderingContext,
      { vertex: basicVertex, fragment: basicFragment },
      { a_position: 0 }
    );

    expect(gl.shaderSource).toHaveBeenCalled();
    expect(gl.attachShader).toHaveBeenCalled();
    expect(gl.bindAttribLocation).toHaveBeenCalledWith(expect.anything(), 0, 'a_position');

    const firstUniform = program.getUniformLocation('u_mvp');
    const secondUniform = program.getUniformLocation('u_mvp');
    expect(firstUniform).toBe(secondUniform);
    expect(gl.getUniformLocation).toHaveBeenCalledTimes(1);

    const firstAttrib = program.getAttributeLocation('a_position');
    const secondAttrib = program.getAttributeLocation('a_position');
    expect(firstAttrib).toBe(3);
    expect(secondAttrib).toBe(3);
    expect(gl.getAttribLocation).toHaveBeenCalledTimes(1);

    program.use();
    expect(gl.useProgram).toHaveBeenCalledWith(program.program);

    program.dispose();
    expect(gl.deleteProgram).toHaveBeenCalledWith(program.program);
  });

  it('throws with shader compile log', () => {
    const gl = createMockWebGL2Context();
    gl.compileSucceeds = false;
    gl.shaderInfoLog = 'bad shader';

    expect(() =>
      createProgramFromSources(gl as unknown as WebGL2RenderingContext, {
        vertex: basicVertex,
        fragment: basicFragment,
      })
    ).toThrowError(/bad shader/);
    expect(gl.deleteShader).toHaveBeenCalled();
  });

  it('throws with program link log and cleans up shaders', () => {
    const gl = createMockWebGL2Context();
    gl.linkSucceeds = false;
    gl.programInfoLog = 'link failed';

    expect(() =>
      ShaderProgram.create(gl as unknown as WebGL2RenderingContext, {
        vertex: basicVertex,
        fragment: basicFragment,
      })
    ).toThrowError(/link failed/);
    expect(gl.deleteShader).toHaveBeenCalledTimes(2);
    expect(gl.deleteProgram).toHaveBeenCalled();
  });
});
