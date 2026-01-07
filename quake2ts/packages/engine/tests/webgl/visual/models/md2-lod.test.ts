import { test } from 'vitest';
import { testWebGLRenderer } from '@quake2ts/test-utils';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const snapshotDir = path.join(__dirname, '..', '..', '__snapshots__');

const CREATE_MD2_HELPER = `
// Helper to create a simple cube MD2 model
function createSimpleMd2Model() {
  const scale = { x: 1, y: 1, z: 1 };
  const translate = { x: 0, y: 0, z: 0 };

  // Vertices for a cube -10 to 10
  const basePositions = [
    { x: -10, y: -10, z: -10 },
    { x: 10, y: -10, z: -10 },
    { x: 10, y: 10, z: -10 },
    { x: -10, y: 10, z: -10 },
    { x: -10, y: -10, z: 10 },
    { x: 10, y: -10, z: 10 },
    { x: 10, y: 10, z: 10 },
    { x: -10, y: 10, z: 10 },
  ];

  const createFrame = (name, offset) => {
    const vertices = basePositions.map((pos, index) => {
        const modPos = {
            x: pos.x + (index % 2 === 0 ? offset : -offset),
            y: pos.y,
            z: pos.z
        };
        return {
            position: modPos,
            normalIndex: 0,
            normal: { x: 0, y: 0, z: 1 }
        };
    });

    return {
      name,
      vertices,
      minBounds: { x: -20, y: -20, z: -20 },
      maxBounds: { x: 20, y: 20, z: 20 }
    };
  };

  const frames = [];
  for (let i = 0; i < 20; i++) {
    frames.push(createFrame(\`frame\${i}\`, i * 0.5));
  }

  const triangles = [
    { vertexIndices: [0, 1, 2], texCoordIndices: [0, 1, 2] },
    { vertexIndices: [0, 2, 3], texCoordIndices: [0, 2, 3] },
    { vertexIndices: [5, 4, 7], texCoordIndices: [1, 0, 3] },
    { vertexIndices: [5, 7, 6], texCoordIndices: [1, 3, 2] },
    { vertexIndices: [3, 2, 6], texCoordIndices: [0, 1, 2] },
    { vertexIndices: [3, 6, 7], texCoordIndices: [0, 2, 3] },
    { vertexIndices: [4, 5, 1], texCoordIndices: [0, 1, 2] },
    { vertexIndices: [4, 1, 0], texCoordIndices: [0, 2, 3] },
    { vertexIndices: [1, 5, 6], texCoordIndices: [0, 1, 2] },
    { vertexIndices: [1, 6, 2], texCoordIndices: [0, 2, 3] },
    { vertexIndices: [4, 0, 3], texCoordIndices: [0, 1, 2] },
    { vertexIndices: [4, 3, 7], texCoordIndices: [0, 2, 3] },
  ];

  const glCommands = triangles.map(t => ({
      mode: 'strip',
      vertices: [
          { s: 0, t: 0, vertexIndex: t.vertexIndices[0] },
          { s: 1, t: 0, vertexIndex: t.vertexIndices[1] },
          { s: 1, t: 1, vertexIndex: t.vertexIndices[2] }
      ]
  }));

  const header = {
      ident: 844121161,
      version: 8,
      skinWidth: 32,
      skinHeight: 32,
      frameSize: 40 + 8 * 4,
      numSkins: 1,
      numVertices: 8,
      numTexCoords: 4,
      numTriangles: 12,
      numGlCommands: 12,
      numFrames: 20,
      offsetSkins: 0,
      offsetTexCoords: 0,
      offsetTriangles: 0,
      offsetFrames: 0,
      offsetGlCommands: 0,
      offsetEnd: 0,
      magic: 844121161
  };

  return {
    header,
    skins: [{ name: 'skin.pcx' }],
    texCoords: [
        { s: 0, t: 0 },
        { s: 32, t: 0 },
        { s: 32, t: 32 },
        { s: 0, t: 32 }
    ],
    triangles,
    frames,
    glCommands
  };
}
`;

test('md2: lod system', { timeout: 30000 }, async () => {
    await testWebGLRenderer(`
      ${CREATE_MD2_HELPER}

      const modelHigh = createSimpleMd2Model();

      // Create scaled down versions for LODs
      const modelMed = JSON.parse(JSON.stringify(modelHigh));
      modelMed.frames.forEach(f => {
          f.vertices.forEach(v => {
              v.position.x *= 0.7;
              v.position.y *= 0.7;
              v.position.z *= 0.7;
          });
      });

      const modelLow = JSON.parse(JSON.stringify(modelHigh));
      modelLow.frames.forEach(f => {
          f.vertices.forEach(v => {
              v.position.x *= 0.4;
              v.position.y *= 0.4;
              v.position.z *= 0.4;
          });
      });

      modelHigh.lods = [modelHigh, modelMed, modelLow];

      const textureData = new Uint8Array(32 * 32 * 4).fill(255);
      const preparedTexture = {
        width: 32,
        height: 32,
        levels: [{
            level: 0,
            width: 32,
            height: 32,
            rgba: textureData
        }],
        source: 'pcx'
      };
      const texture = renderer.registerTexture('player-skin', preparedTexture);

      const mat4 = Quake2Engine.mat4;
      const Camera = Quake2Engine.Camera;
      const camera = new Camera(mat4.create());
      camera.setPosition([0, 0, 0]);
      camera.lookAt([0, 0, -1]);
      camera.setPerspective(60, 1.0, 0.1, 5000);

      const distances = [100, 600, 1200];

      const world = {
        textures: new Map([['player-skin', texture]]),
        map: null
      };

      gl.clearColor(0.2, 0.2, 0.3, 1.0);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

      for (let i = 0; i < distances.length; i++) {
        gl.viewport(i * 256, 0, 256, 256);
        gl.scissor(i * 256, 0, 256, 256);
        gl.enable(gl.SCISSOR_TEST);

        const dist = distances[i];

        const entity = {
          id: 1,
          type: 'md2',
          model: modelHigh,
          skin: 'player-skin',
          transform: mat4.fromTranslation(mat4.create(), [0, 0, -dist]),
          blend: { frame0: 0, frame1: 0, lerp: 0 },
          tint: [1, 1, 1, 1],
          lighting: { ambient: [1, 1, 1], dynamicLights: [], modelMatrix: mat4.create() }
        };

        renderer.renderFrame({
            camera,
            clearColor: [0.2, 0.2, 0.3, 1.0],
            width: 768,
            height: 256,
            time: 0,
            world
        }, [entity]);
      }
      gl.disable(gl.SCISSOR_TEST);
    `, {
      name: 'md2-lod',
      description: 'MD2 LOD switching at distances 100, 600, 1200',
      width: 768,
      height: 256,
      snapshotDir
    });
  });
