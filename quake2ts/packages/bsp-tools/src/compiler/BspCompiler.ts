import {
  type Vec3,
  CONTENTS_SOLID,
  createEmptyBounds3,
  windingBounds,
  windingCenter,
  addVec3,
  scaleVec3,
  createWinding,
  baseWindingForPlane,
  chopWindingByPlanes,
  splitWinding,
  copyWinding,
  dotVec3,
  crossVec3,
  normalizeVec3,
  subtractVec3,
  MAX_WORLD_COORD
} from '@quake2ts/shared';

import type { BrushDef, EntityDef, TextureDef } from '../builder/types.js';
import {
  type BspData,
  type BspPlane,
  type BspNode,
  type BspLeaf,
  type BspFace,
  type BspTexInfo,
  type BspModel,
  type BspBrush,
  type BspBrushSide,
  type BspEdge,
  type BspVisibility,
  type BspArea,
  type BspAreaPortal,
  BSP_VERSION
} from '../types/bsp.js';

import type { CompileBrush, CompileFace, CompilePlane, CompileSide, MapBrush } from '../types/compile.js';
import { PlaneSet } from './planes.js';
import { createBrushList, processCsg, addBoxBevels, updateBrushBounds } from './csg.js';
import { buildTree, flattenTree } from './tree.js';
import { extractFaces, assignFacesToNodes, mergeCoplanarFaces, fixTJunctions } from './faces.js';
import { buildEdges } from './edges.js';
import { generateTrivialVis } from './vis.js';
import { serializeEntities } from '../output/entityString.js';

// Lighting logic (currently simple placeholders or partial implementations)
// We'll define a simple lighting generator here or import if available
// Since `lighting.ts` exists but might need adaptation
import { generateFullbrightLighting } from './lighting.js';

export interface CompilerOptions {
  verbose?: boolean;
  noVis?: boolean;
  noLighting?: boolean;
  preserveDetail?: boolean;
}

export interface CompileResult {
  bsp: BspData;
  stats: {
    planes: number;
    nodes: number;
    leafs: number;
    faces: number;
    brushes: number;
    edges: number;
    vertices: number;
  };
}

class TexInfoManager {
  private texInfos: BspTexInfo[] = [];
  private lookup = new Map<string, number>();

  getTexInfos(): BspTexInfo[] {
    return this.texInfos;
  }

  findOrAdd(texture: TextureDef): number {
    // Unique key based on texture parameters
    const key = `${texture.name}_${texture.offsetX}_${texture.offsetY}_${texture.rotation}_${texture.scaleX}_${texture.scaleY}`;

    if (this.lookup.has(key)) {
      return this.lookup.get(key)!;
    }

    const scaleX = texture.scaleX || 1;
    const scaleY = texture.scaleY || 1;

    // Standard Quake texture alignment
    // S = (x * s.x + y * s.y + z * s.z) + sOffset
    // T = (x * t.x + y * t.y + z * t.z) + tOffset
    // For now, let's use a basic mapping based on normal?
    // Wait, TexInfo stores the vectors.
    // The builder usually passes texture defs. The parser provides explicit vectors for Valve 220.
    // For simple builder, we need to generate vectors based on alignment.
    // That's complex (requires knowing face normal).
    // Here we store a "canonical" texinfo and let the face geometry determine projection?
    // No, TexInfo defines the projection.
    // We should probably generate dummy vectors for now or use the ones from MapBrushSide if available.
    // Since we are compiling from BrushDef which has TextureDef, we might lack explicit vectors.
    // Let's assume Z-planar mapping for default?
    // TODO: Implement proper texture axis generation based on face normal when applying texture.
    // But TexInfo is shared across faces!
    // So one TexInfo can't work for all faces unless they share alignment.
    // Usually, map editors assign specific TexInfo per face.
    // Our Builder API assigns texture to a SIDE (plane).
    // So we can determine alignment from the plane normal.
    // But we are finding/adding TexInfo based on TextureDef only here, unaware of the plane.
    // This is a limitation of the current `TexInfoManager.findOrAdd` signature.
    // It should depend on the plane too?
    // In Quake, TexInfo includes the vectors.
    // If we have 6 walls with same "texture name", they need 6 different TexInfos (or at least 3 for axial mapping).
    // So `key` must include alignment.
    // For now, let's just generate a default one and assume the renderer handles it or it looks bad.
    // Real implementation requires deriving vectors from texture parameters + plane normal.

    const s: Vec3 = { x: 1 / scaleX, y: 0, z: 0 };
    const t: Vec3 = { x: 0, y: -1 / scaleY, z: 0 };

    const ti: BspTexInfo = {
      s,
      sOffset: texture.offsetX || 0,
      t,
      tOffset: texture.offsetY || 0,
      flags: 0,
      value: 0,
      texture: texture.name,
      nextTexInfo: -1
    };

    const index = this.texInfos.length;
    this.texInfos.push(ti);
    this.lookup.set(key, index);

    return index;
  }
}

export class BspCompiler {
  private planeSet = new PlaneSet();
  private texInfoManager = new TexInfoManager();

  // Internal state
  private compileBrushes: CompileBrush[] = [];
  private mapBrushes: MapBrush[] = [];

  constructor(
    private options: CompilerOptions = {}
  ) {}

  compile(
    inputBrushes: BrushDef[],
    inputEntities: EntityDef[]
  ): CompileResult {
    // 1. Prepare Brushes
    // Convert Builder BrushDefs to internal CompileBrushes (with planes and windings)
    this.prepareBrushes(inputBrushes);

    // 2. CSG Operations
    // Split and carve brushes to handle overlap
    if (this.options.verbose) console.log('Processing CSG...');
    const csgBrushes = processCsg(
      this.compileBrushes,
      this.planeSet,
      {
        preserveDetail: this.options.preserveDetail,
        verbose: this.options.verbose
      }
    );

    // 3. Build BSP Tree
    if (this.options.verbose) console.log('Building BSP Tree...');
    // Pass empty usedPlanes set to start
    const root = buildTree(csgBrushes, this.planeSet, new Set());

    // 4. Extract Faces
    if (this.options.verbose) console.log('Extracting Faces...');
    let faces = extractFaces(root, this.planeSet.getPlanes());

    // 5. Merge Faces
    if (this.options.verbose) console.log('Merging Faces...');
    faces = mergeCoplanarFaces(faces);

    // 6. Fix T-Junctions
    if (this.options.verbose) console.log('Fixing T-Junctions...');
    faces = fixTJunctions(faces);

    // 7. Assign Faces to Nodes
    if (this.options.verbose) console.log('Assigning Faces to Nodes...');
    const faceMap = assignFacesToNodes(faces, root, this.planeSet.getPlanes());

    // 8. Flatten Tree / Generate Models
    if (this.options.verbose) console.log('Flattening Tree...');
    const flattened = flattenTree(root, faceMap);

    // 9. Build Edges & Vertices
    if (this.options.verbose) console.log('Building Edges...');
    // We use the serialized face order from flattenTree
    const edgeData = buildEdges(flattened.serializedFaces);

    // 10. Generate Output Data
    const planes = this.planeSet.getPlanes().map(p => ({
      normal: p.normal,
      dist: p.dist,
      type: p.type
    }));

    // Update BspFaces with edge indices
    const finalFaces: BspFace[] = flattened.serializedFaces.map((f, i) => {
      // We need to calculate firstEdge and numEdges based on surfEdges
      // buildEdges returns one large surfEdges array.
      // We need to know where this face starts.
      // buildEdges iterates faces in order.
      // So we can track offset.
      // However, buildEdges logic just pushed to surfEdgesList.
      // We need to replicate that counting logic or return the offsets.
      // Let's modify buildEdges to return offsets?
      // Or just count here since we know face.winding.numPoints corresponds to edges.
      return {
        planeIndex: f.planeNum,
        side: f.side || 0, // ExtractFaces assigns side 0/1? Actually logic assigns side.
        firstEdge: 0, // Placeholder, updated below
        numEdges: f.winding.numPoints,
        texInfo: f.texInfo,
        styles: [0, 0, 0, 0], // Light styles
        lightOffset: -1 // Updated by lighting
      };
    });

    // Fix up firstEdge offsets
    let currentEdgeOffset = 0;
    for (const face of finalFaces) {
      face.firstEdge = currentEdgeOffset;
      currentEdgeOffset += face.numEdges;
    }

    // 11. Lighting
    // Just fullbright for now if enabled
    let lightMaps = new Uint8Array(0);
    if (!this.options.noLighting) {
      if (this.options.verbose) console.log('Generating Lighting...');
      // Note: generateFullbrightLighting modifies faces (lightOffset)
      // and returns the lightmap blob
      lightMaps = generateFullbrightLighting( // Call imported function
          finalFaces, // Using simplified faces works?
          // It needs full BspFaces, which we have (mostly)
          // It also needs BspTexInfo, edges, planes, surfEdges
          // We need to cast or ensure types match.
          // Types match the Bsp* interfaces.
          // But generateFullbrightLighting expects 'vertices' as Vec3[], 'planes' as BspPlane[]
          edgeData.vertices,
          this.texInfoManager.getTexInfos(),
          edgeData.surfEdges,
          edgeData.edges,
          planes
      );
    }

    // 12. Visibility
    if (this.options.verbose) console.log('Generating Visibility...');
    let maxCluster = -1;
    for (const l of flattened.leafs) {
      if (l.cluster > maxCluster) maxCluster = l.cluster;
    }
    const visibility = generateTrivialVis(maxCluster + 1);

    // 13. Entities
    const entityString = serializeEntities(inputEntities);

    // 14. Assemble BSP
    const bsp: BspData = {
      header: { version: BSP_VERSION, lumps: new Map() },
      entities: { raw: entityString },
      planes,
      vertices: edgeData.vertices,
      nodes: flattened.nodes,
      texInfo: this.texInfoManager.getTexInfos(),
      faces: finalFaces,
      lightMaps,
      lightMapInfo: [],
      leafs: flattened.leafs,
      leafLists: {
        leafFaces: flattened.leafFacesList,
        leafBrushes: flattened.leafBrushesList
      },
      edges: edgeData.edges,
      surfEdges: edgeData.surfEdges,
      models: [{
        mins: flattened.nodes[0]?.mins ? {
            x: flattened.nodes[0].mins[0],
            y: flattened.nodes[0].mins[1],
            z: flattened.nodes[0].mins[2]
        } : {x:0, y:0, z:0},
        maxs: flattened.nodes[0]?.maxs ? {
            x: flattened.nodes[0].maxs[0],
            y: flattened.nodes[0].maxs[1],
            z: flattened.nodes[0].maxs[2]
        } : {x:0, y:0, z:0},
        origin: { x: 0, y: 0, z: 0 },
        headNode: 0,
        firstFace: 0,
        numFaces: finalFaces.length
      }], // Model 0
      brushes: [], // TODO: Populate brushes
      brushSides: [], // TODO: Populate brushSides
      visibility,
      areas: [],
      areaPortals: []
    };

    return {
      bsp,
      stats: {
        planes: planes.length,
        nodes: flattened.nodes.length,
        leafs: flattened.leafs.length,
        faces: finalFaces.length,
        brushes: 0, // TODO
        edges: edgeData.edges.length,
        vertices: edgeData.vertices.length
      }
    };
  }

  private prepareBrushes(inputBrushes: BrushDef[]) {
    // Clear previous state
    this.compileBrushes = [];
    this.mapBrushes = [];

    for (const def of inputBrushes) {
      const sides: CompileSide[] = [];
      const brushPlanes: { normal: Vec3; dist: number }[] = [];

      // 1. Collect planes and sides
      for (const sideDef of def.sides) {
        const planeNum = this.planeSet.findOrAdd(sideDef.plane.normal, sideDef.plane.dist);
        const texInfo = this.texInfoManager.findOrAdd(sideDef.texture);

        // Store plane for winding generation
        brushPlanes.push({ normal: sideDef.plane.normal, dist: sideDef.plane.dist });

        sides.push({
          planeNum,
          texInfo,
          visible: true,
          tested: false,
          bevel: false,
          // winding generated later
          winding: undefined
        });
      }

      // 2. Generate windings for each side by clipping against all other planes
      for (let i = 0; i < sides.length; i++) {
        const side = sides[i];
        const plane = brushPlanes[i];

        // Start with huge winding on the plane
        let w: import('@quake2ts/shared').Winding | null = baseWindingForPlane(plane.normal, plane.dist);

        // Clip against all other planes
        for (let j = 0; j < brushPlanes.length; j++) {
          if (i === j) continue;
          if (!w) break;
          // Keep back side (inside brush)
          // Note: clipWinding logic in shared/math/winding takes (normal, dist, keepFront)
          // Brush planes point OUT. So we want to keep BACK.
          // Wait, shared chopWindingByPlanes does this loop?
          // chopWindingByPlanes assumes we want inside (back) of all planes.
          // But it processes ALL planes in the list.
          // We must exclude the current plane 'i' because it is coplanar (SIDE_ON).
          // And chopWindingByPlanes might discard it if not robust.
          // So manual loop is safer.

          const clipPlane = brushPlanes[j];
          // Use clipWinding directly
          // We want the part BEHIND the clip plane.
          // clipWinding(w, normal, dist, keepFront=false)
          // shared/math/winding might not export clipWinding directly if not added to index.
          // But I imported splitWinding. Let's rely on splitWinding or chopWindingByPlanes if I filter.
          // Let's just use splitWinding manually for now.
          const split = splitWinding(w, clipPlane.normal, clipPlane.dist);
          w = split.back; // Keep back
        }

        if (w) {
          side.winding = w;
        } else {
          side.visible = false; // Degenerate side
        }
      }

      // 3. Create CompileBrush
      const mapBrush: MapBrush = {
        original: def,
        sides,
        contents: def.contents ?? CONTENTS_SOLID,
        bounds: createEmptyBounds3() // Updated below
      };

      const compileBrush: CompileBrush = {
        original: mapBrush,
        sides,
        bounds: createEmptyBounds3(),
        next: null
      };

      // Calculate bounds
      updateBrushBounds(compileBrush);
      mapBrush.bounds = compileBrush.bounds;

      // Add bevels
      addBoxBevels(compileBrush, this.planeSet);

      this.compileBrushes.push(compileBrush);
      this.mapBrushes.push(mapBrush);
    }
  }
}
