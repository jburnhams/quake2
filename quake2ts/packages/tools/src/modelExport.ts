import { Md2Model, Md3Model } from '@quake2ts/engine';

/**
 * Export MD2 model frame to OBJ format
 * @param model Parsed MD2 model
 * @param frameIndex Frame index to export
 * @returns OBJ file contents as string
 */
export function exportMd2ToObj(model: Md2Model, frameIndex: number): string {
  if (frameIndex < 0 || frameIndex >= model.frames.length) {
    throw new Error(`Frame index ${frameIndex} out of bounds (0-${model.frames.length - 1})`);
  }

  const frame = model.frames[frameIndex];
  const lines: string[] = [];

  lines.push(`# Quake 2 MD2 to OBJ Export`);
  lines.push(`# Model: ${model.header.skinWidth}x${model.header.skinHeight}`);
  lines.push(`# Frame: ${frameIndex} (${frame.name})`);
  lines.push(`o ${frame.name}`);

  // Write vertices
  // OBJ vertices are "v x y z"
  // Quake uses Z-up, Y-forward? No, Quake is Z-up. OBJ is typically Y-up?
  // Actually, standard OBJ is just points. Tools usually expect Y-up.
  // Quake coords: X=Forward, Y=Left, Z=Up.
  // Blender/Standard: X=Right, Y=Up, Z=Back.
  // We usually export as-is and let the user handle rotation, or swap Y/Z.
  // The request doesn't specify coordinate conversion. I will export as-is (Quake coordinates).
  // Note: MD2 vertices are in local model space.
  for (const v of frame.vertices) {
    lines.push(`v ${v.position.x.toFixed(6)} ${v.position.y.toFixed(6)} ${v.position.z.toFixed(6)}`);
  }

  // Write texture coordinates
  // OBJ UVs are "vt u v"
  // MD2 tex coords are integers, need to normalize by skin size.
  // Also MD2 (0,0) is top-left, OBJ (0,0) is usually bottom-left.
  // So v = 1 - (t / height).
  const width = model.header.skinWidth;
  const height = model.header.skinHeight;
  for (const tc of model.texCoords) {
    const u = tc.s / width;
    const v = 1.0 - (tc.t / height);
    lines.push(`vt ${u.toFixed(6)} ${v.toFixed(6)}`);
  }

  // Write normals
  // MD2 stores normals in frame.vertices[i].normal
  for (const v of frame.vertices) {
    lines.push(`vn ${v.normal.x.toFixed(6)} ${v.normal.y.toFixed(6)} ${v.normal.z.toFixed(6)}`);
  }

  // Write faces
  // f v1/vt1/vn1 v2/vt2/vn2 v3/vt3/vn3
  // Indices are 1-based in OBJ.
  lines.push(`s off`); // Smoothing groups off
  for (const tri of model.triangles) {
    const v1 = tri.vertexIndices[0] + 1;
    const v2 = tri.vertexIndices[1] + 1;
    const v3 = tri.vertexIndices[2] + 1;

    const vt1 = tri.texCoordIndices[0] + 1;
    const vt2 = tri.texCoordIndices[1] + 1;
    const vt3 = tri.texCoordIndices[2] + 1;

    // Normal indices match vertex indices in MD2 (per-vertex normals)
    const vn1 = v1;
    const vn2 = v2;
    const vn3 = v3;

    // Reverse winding? Quake is clockwise? OpenGL is CCW.
    // MD2 is usually Clockwise winding for front face?
    // Let's stick to the order in the file.
    lines.push(`f ${v1}/${vt1}/${vn1} ${v2}/${vt2}/${vn2} ${v3}/${vt3}/${vn3}`);
  }

  return lines.join('\n');
}

/**
 * Export MD3 model to glTF 2.0 format
 * Currently exports the first frame as a static mesh.
 * @param model Parsed MD3 model
 * @returns glTF JSON and binary buffer
 */
export function exportMd3ToGltf(model: Md3Model): {
  json: string
  buffer: ArrayBuffer
} {
  // Structure for GLTF
  const gltf: any = {
    asset: {
      version: "2.0",
      generator: "quake2ts-tools"
    },
    scenes: [
      {
        nodes: [0]
      }
    ],
    nodes: [
      {
        name: model.header.name,
        mesh: 0
      }
    ],
    meshes: [
      {
        name: model.header.name,
        primitives: []
      }
    ],
    buffers: [
      {
        byteLength: 0 // To be filled
      }
    ],
    bufferViews: [],
    accessors: []
  };

  const binaryData: number[] = [];

  // Helpers to append data and create views
  const addBufferView = (data: Uint8Array, target?: number) => {
    const byteOffset = binaryData.length;
    // Align to 4 bytes
    while (binaryData.length % 4 !== 0) {
      binaryData.push(0);
    }
    const alignedOffset = binaryData.length;
    for (let i = 0; i < data.length; i++) {
      binaryData.push(data[i]);
    }
    const byteLength = data.length;
    const viewIndex = gltf.bufferViews.length;
    gltf.bufferViews.push({
      buffer: 0,
      byteOffset: alignedOffset,
      byteLength: byteLength,
      target: target
    });
    return viewIndex;
  };

  const addAccessor = (bufferView: number, componentType: number, count: number, type: string, min?: number[], max?: number[]) => {
    const index = gltf.accessors.length;
    const acc: any = {
      bufferView,
      componentType, // 5126=FLOAT, 5123=USHORT, 5125=UINT
      count,
      type, // "SCALAR", "VEC2", "VEC3"
    };
    if (min) acc.min = min;
    if (max) acc.max = max;
    gltf.accessors.push(acc);
    return index;
  };

  // Process surfaces
  // For each surface, export frame 0 geometry
  // MD3 has separate surfaces which map to GLTF primitives

  // We use frame 0
  const frameIndex = 0;

  for (const surface of model.surfaces) {
    // Vertices for frame 0
    const frameVerts = surface.vertices[frameIndex];

    // Positions (Vec3)
    const positions = new Float32Array(frameVerts.length * 3);
    const normals = new Float32Array(frameVerts.length * 3);
    const texCoords = new Float32Array(frameVerts.length * 2);

    let minPos = [Infinity, Infinity, Infinity];
    let maxPos = [-Infinity, -Infinity, -Infinity];

    for (let i = 0; i < frameVerts.length; i++) {
      const v = frameVerts[i];
      positions[i * 3] = v.position.x;
      positions[i * 3 + 1] = v.position.y;
      positions[i * 3 + 2] = v.position.z;

      minPos[0] = Math.min(minPos[0], v.position.x);
      minPos[1] = Math.min(minPos[1], v.position.y);
      minPos[2] = Math.min(minPos[2], v.position.z);
      maxPos[0] = Math.max(maxPos[0], v.position.x);
      maxPos[1] = Math.max(maxPos[1], v.position.y);
      maxPos[2] = Math.max(maxPos[2], v.position.z);

      normals[i * 3] = v.normal.x;
      normals[i * 3 + 1] = v.normal.y;
      normals[i * 3 + 2] = v.normal.z;

      // TexCoords (shared across frames in MD3)
      const tc = surface.texCoords[i];
      texCoords[i * 2] = tc.s;
      texCoords[i * 2 + 1] = 1.0 - tc.t; // Flip V
    }

    // Indices (Triangles)
    // MD3 indices are per surface
    const indices = new Uint16Array(surface.triangles.length * 3);
    for (let i = 0; i < surface.triangles.length; i++) {
        indices[i * 3] = surface.triangles[i].indices[0];
        indices[i * 3 + 1] = surface.triangles[i].indices[1];
        indices[i * 3 + 2] = surface.triangles[i].indices[2];
    }

    // Create BufferViews
    const posView = addBufferView(new Uint8Array(positions.buffer), 34962); // ARRAY_BUFFER
    const normView = addBufferView(new Uint8Array(normals.buffer), 34962);
    const tcView = addBufferView(new Uint8Array(texCoords.buffer), 34962);
    const idxView = addBufferView(new Uint8Array(indices.buffer), 34963); // ELEMENT_ARRAY_BUFFER

    // Create Accessors
    const posAcc = addAccessor(posView, 5126, frameVerts.length, "VEC3", minPos, maxPos);
    const normAcc = addAccessor(normView, 5126, frameVerts.length, "VEC3");
    const tcAcc = addAccessor(tcView, 5126, frameVerts.length, "VEC2");
    const idxAcc = addAccessor(idxView, 5123, indices.length, "SCALAR");

    // Add Primitive
    gltf.meshes[0].primitives.push({
      attributes: {
        POSITION: posAcc,
        NORMAL: normAcc,
        TEXCOORD_0: tcAcc
      },
      indices: idxAcc,
      material: undefined // Could add material info if needed
    });
  }

  // Finalize buffer
  // Pad to 4 bytes
  while (binaryData.length % 4 !== 0) {
    binaryData.push(0);
  }
  gltf.buffers[0].byteLength = binaryData.length;

  return {
    json: JSON.stringify(gltf, null, 2),
    buffer: new Uint8Array(binaryData).buffer
  };
}
