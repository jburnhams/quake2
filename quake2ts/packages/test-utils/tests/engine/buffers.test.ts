import { describe, it, expect, vi } from 'vitest';
import { createMockVertexBuffer, createMockIndexBuffer, createMockShaderProgram, createMockShader } from '../../src/engine/mocks/buffers';
import { createMockWebGL2Context } from '../../src/engine/mocks/webgl';

describe('Buffer and Shader Mocks', () => {
  describe('createMockVertexBuffer', () => {
    it('should create a VertexBuffer and bind it', () => {
      const vb = createMockVertexBuffer();
      expect(vb).toBeDefined();
      vb.bind();
      expect(vb.bind).toHaveBeenCalled();
    });

    it('should upload data if provided', () => {
      const data = new Float32Array([1, 2, 3]);
      const vb = createMockVertexBuffer(data);
      expect(vb.upload).toHaveBeenCalledWith(data, expect.anything());
    });

    it('should allow updating data', () => {
      const vb = createMockVertexBuffer();
      const data = new Float32Array([4, 5, 6]);
      vb.update(data, 0);
      expect(vb.update).toHaveBeenCalledWith(data, 0);
    });

    it('should dispose the buffer', () => {
      const vb = createMockVertexBuffer();
      vb.dispose();
      expect(vb.dispose).toHaveBeenCalled();
    });
  });

  describe('createMockIndexBuffer', () => {
    it('should create an IndexBuffer and bind it', () => {
      const ib = createMockIndexBuffer();
      expect(ib).toBeDefined();
      ib.bind();
      expect(ib.bind).toHaveBeenCalled();
    });

    it('should upload data if provided', () => {
      const data = new Uint16Array([1, 2, 3]);
      const ib = createMockIndexBuffer(data);
      expect(ib.upload).toHaveBeenCalledWith(data, expect.anything());
    });
  });

  describe('createMockShaderProgram', () => {
    it('should create a ShaderProgram', () => {
      const program = createMockShaderProgram();
      expect(program).toBeDefined();
    });

    it('should allow overrides', () => {
      const use = vi.fn();
      const program = createMockShaderProgram({ use });
      program.use();
      expect(use).toHaveBeenCalled();
    });

    it('should spy on methods', () => {
      const program = createMockShaderProgram();
      program.use();
      expect(program.use).toHaveBeenCalled();

      program.getUniformLocation('u_test');
      expect(program.getUniformLocation).toHaveBeenCalledWith('u_test');

      program.getAttributeLocation('a_test');
      expect(program.getAttributeLocation).toHaveBeenCalledWith('a_test');

      program.dispose();
      expect(program.dispose).toHaveBeenCalled();
    });
  });

  describe('createMockShader', () => {
    it('should create a shader program from source strings', () => {
      const program = createMockShader('vertex source', 'fragment source');
      expect(program).toBeDefined();
      // Since it uses real WebGL calls on a mock context, we verify the context was called
      // Accessing the private gl property via casting or just assuming success if no error thrown
      expect(program.gl).toBeDefined();
    });
  });
});
