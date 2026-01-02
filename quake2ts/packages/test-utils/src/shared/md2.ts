import { ANORMS, Vec3 } from '@quake2ts/shared';
import {
  Md2Frame,
  Md2GlCommand,
  Md2GlCommandVertex,
  Md2Header,
  Md2Model,
  Md2Skin,
  Md2TexCoord,
  Md2Triangle,
  Md2Vertex
} from '@quake2ts/engine';

export function createSimpleMd2Model(): Md2Model {
  // Create a simple cube model
  // 8 vertices
  const scale: Vec3 = { x: 1, y: 1, z: 1 };
  const translate: Vec3 = { x: 0, y: 0, z: 0 };

  // Vertices for a cube -10 to 10
  const basePositions: Vec3[] = [
    { x: -10, y: -10, z: -10 }, // 0
    { x: 10, y: -10, z: -10 },  // 1
    { x: 10, y: 10, z: -10 },   // 2
    { x: -10, y: 10, z: -10 },  // 3
    { x: -10, y: -10, z: 10 },  // 4
    { x: 10, y: -10, z: 10 },   // 5
    { x: 10, y: 10, z: 10 },    // 6
    { x: -10, y: 10, z: 10 },   // 7
  ];

  // Helper to create a frame with slight modification for animation
  const createFrame = (name: string, offset: number): Md2Frame => {
    const vertices: Md2Vertex[] = basePositions.map((pos, index) => {
        // Simple animation: move vertices along normals based on offset
        // For a cube, normals are axis aligned. We'll just fake it.
        const modPos = {
            x: pos.x + (index % 2 === 0 ? offset : -offset),
            y: pos.y,
            z: pos.z
        };
        return {
            position: modPos,
            normalIndex: 0, // Dummy normal index
            normal: { x: 0, y: 0, z: 1 } // Dummy normal
        };
    });

    return {
      name,
      vertices,
      minBounds: { x: -20, y: -20, z: -20 },
      maxBounds: { x: 20, y: 20, z: 20 }
    };
  };

  // Create 20 frames
  const frames: Md2Frame[] = [];
  for (let i = 0; i < 20; i++) {
    frames.push(createFrame(`frame${i}`, i * 0.5));
  }

  // Create simple triangles (cube faces)
  // 6 faces * 2 triangles = 12 triangles
  const triangles: Md2Triangle[] = [
    // Front
    { vertexIndices: [0, 1, 2], texCoordIndices: [0, 1, 2] },
    { vertexIndices: [0, 2, 3], texCoordIndices: [0, 2, 3] },
    // Back
    { vertexIndices: [5, 4, 7], texCoordIndices: [1, 0, 3] },
    { vertexIndices: [5, 7, 6], texCoordIndices: [1, 3, 2] },
    // Top
    { vertexIndices: [3, 2, 6], texCoordIndices: [0, 1, 2] },
    { vertexIndices: [3, 6, 7], texCoordIndices: [0, 2, 3] },
    // Bottom
    { vertexIndices: [4, 5, 1], texCoordIndices: [0, 1, 2] },
    { vertexIndices: [4, 1, 0], texCoordIndices: [0, 2, 3] },
    // Right
    { vertexIndices: [1, 5, 6], texCoordIndices: [0, 1, 2] },
    { vertexIndices: [1, 6, 2], texCoordIndices: [0, 2, 3] },
    // Left
    { vertexIndices: [4, 0, 3], texCoordIndices: [0, 1, 2] },
    { vertexIndices: [4, 3, 7], texCoordIndices: [0, 2, 3] },
  ];

  // Dummy GL Commands (Strip/Fan)
  // For simplicity we can just make GL commands match triangles or leave empty if the renderer supports raw triangles
  // The renderer likely uses glCommands if available. Let's create a simple strip for each triangle.
  const glCommands: Md2GlCommand[] = triangles.map(t => ({
      mode: 'strip', // or 'fan', doesn't matter for 3 verts
      vertices: [
          { s: 0, t: 0, vertexIndex: t.vertexIndices[0] },
          { s: 1, t: 0, vertexIndex: t.vertexIndices[1] },
          { s: 1, t: 1, vertexIndex: t.vertexIndices[2] }
      ]
  }));

  const header: Md2Header = {
      ident: 844121161,
      version: 8,
      skinWidth: 32,
      skinHeight: 32,
      frameSize: 40 + 8 * 4, // header + verts * 4
      numSkins: 1,
      numVertices: 8,
      numTexCoords: 4, // Simplified
      numTriangles: 12,
      numGlCommands: 12, // One per triangle for simplicity
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

export async function loadMd2Model(filename: string): Promise<Md2Model> {
  // In a real scenario this might load from disk or a pak.
  // For tests, we'll return the procedural model if the name matches 'simple-cube.md2'
  if (filename === 'simple-cube.md2') {
    return createSimpleMd2Model();
  }

  // TODO: Add logic to load from actual fixtures if needed
  throw new Error(`Model ${filename} not found in test fixtures`);
}
