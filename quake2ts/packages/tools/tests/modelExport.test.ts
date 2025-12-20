import { describe, it, expect } from 'vitest';
import { exportMd2ToObj, exportMd3ToGltf } from '../src/modelExport.js';
import { Md2Model, Md3Model } from '@quake2ts/engine';
import { Vec3 } from '@quake2ts/shared';

describe('modelExport', () => {
  describe('exportMd2ToObj', () => {
    it('should export a simple MD2 model to OBJ', () => {
      const model: Md2Model = {
        header: {
          skinWidth: 128,
          skinHeight: 128,
        } as any,
        skins: [],
        texCoords: [
          { s: 0, t: 0 },
          { s: 64, t: 0 },
          { s: 0, t: 64 },
        ],
        triangles: [
          {
            vertexIndices: [0, 1, 2],
            texCoordIndices: [0, 1, 2],
          },
        ],
        frames: [
          {
            name: 'frame0',
            vertices: [
              { position: { x: 0, y: 0, z: 0 }, normal: { x: 0, y: 0, z: 1 }, normalIndex: 0 },
              { position: { x: 10, y: 0, z: 0 }, normal: { x: 0, y: 0, z: 1 }, normalIndex: 0 },
              { position: { x: 0, y: 10, z: 0 }, normal: { x: 0, y: 0, z: 1 }, normalIndex: 0 },
            ],
            minBounds: { x: 0, y: 0, z: 0 },
            maxBounds: { x: 10, y: 10, z: 0 },
          },
        ],
        glCommands: [],
      };

      const obj = exportMd2ToObj(model, 0);

      expect(obj).toContain('o frame0');
      // Check vertices
      expect(obj).toContain('v 0.000000 0.000000 0.000000');
      expect(obj).toContain('v 10.000000 0.000000 0.000000');

      // Check tex coords (normalized and V flipped)
      // 0/128 = 0, 1-0 = 1.0
      expect(obj).toContain('vt 0.000000 1.000000');
      // 64/128 = 0.5, 1-0 = 1.0
      expect(obj).toContain('vt 0.500000 1.000000');
      // 0/128 = 0, 1-0.5 = 0.5
      expect(obj).toContain('vt 0.000000 0.500000');

      // Check normals
      expect(obj).toContain('vn 0.000000 0.000000 1.000000');

      // Check face (1-based indices)
      expect(obj).toContain('f 1/1/1 2/2/2 3/3/3');
    });

    it('should throw error for invalid frame index', () => {
        const model: Md2Model = {
            frames: []
        } as any;
        expect(() => exportMd2ToObj(model, 0)).toThrow();
    });
  });

  describe('exportMd3ToGltf', () => {
    it('should export a simple MD3 model to GLTF', () => {
      const model: Md3Model = {
        header: {
          name: 'testmodel',
        } as any,
        frames: [],
        tags: [],
        surfaces: [
          {
            name: 'surface1',
            flags: 0,
            numFrames: 1,
            shaders: [],
            triangles: [
              { indices: [0, 1, 2] }
            ],
            texCoords: [
              { s: 0, t: 0 },
              { s: 0.5, t: 0 },
              { s: 0, t: 0.5 }
            ],
            vertices: [
              // Frame 0 vertices
              [
                { position: { x: 0, y: 0, z: 0 }, normal: { x: 0, y: 0, z: 1 }, latLng: 0 },
                { position: { x: 10, y: 0, z: 0 }, normal: { x: 0, y: 0, z: 1 }, latLng: 0 },
                { position: { x: 0, y: 10, z: 0 }, normal: { x: 0, y: 0, z: 1 }, latLng: 0 }
              ]
            ]
          }
        ]
      };

      const result = exportMd3ToGltf(model);

      const gltf = JSON.parse(result.json);
      expect(gltf.asset.version).toBe('2.0');
      expect(gltf.meshes[0].primitives[0].attributes.POSITION).toBeDefined();
      expect(gltf.meshes[0].primitives[0].indices).toBeDefined();

      // Check buffer size
      expect(result.buffer.byteLength).toBeGreaterThan(0);
    });
  });
});
