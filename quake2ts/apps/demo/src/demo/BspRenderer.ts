import { BspLoader, BspMap, BspSurfaceInput, buildBspGeometry, BspSurfaceGeometry, LightmapAtlas, gatherVisibleFaces, BspSurfacePipeline, applySurfaceState, TextureCache, AssetManager, VirtualFileSystem, BspFace, BspTexInfo, Texture2D, PreparedTexture, Camera } from '@quake2ts/engine';
import { Mat4, aabb, Vec3, multiplyMat4 } from '@quake2ts/shared';

export function extractBspSurfaces(map: BspMap, textureCache: Map<string, PreparedTexture>): BspSurfaceInput[] {
    const surfaces: BspSurfaceInput[] = [];

    for (let i = 0; i < map.faces.length; i++) {
        const face = map.faces[i];
        const texInfo = map.texInfo[face.texInfo];

        const texture = textureCache.get(texInfo.texture);
        if (!texture) {
            console.warn(`Texture not found: ${texInfo.texture}`);
            continue;
        }

        const vertices: number[] = [];
        const textureCoords: number[] = [];
        const lightmapCoords: number[] = [];
        const indices: number[] = [];

        const faceVertices: Vec3[] = [];

        for (let j = 0; j < face.numEdges; j++) {
            const edgeIndex = map.surfEdges[face.firstEdge + j];
            const edge = map.edges[Math.abs(edgeIndex)];
            const vIndex = edgeIndex > 0 ? edge.vertices[0] : edge.vertices[1]
            faceVertices.push(map.vertices[vIndex]);
        }
        faceVertices.reverse();

        let minU = Infinity, minV = Infinity;
        let maxU = -Infinity, maxV = -Infinity;

        for (const vertex of faceVertices) {
            const u = vertex[0] * texInfo.s[0] + vertex[1] * texInfo.s[1] + vertex[2] * texInfo.s[2] + texInfo.sOffset;
            const v = vertex[0] * texInfo.t[0] + vertex[1] * texInfo.t[1] + vertex[2] * texInfo.t[2] + texInfo.tOffset;

            minU = Math.min(minU, u);
            minV = Math.min(minV, v);
            maxU = Math.max(maxU, u);
            maxV = Math.max(maxV, v);
        }

        const lightmapWidth = Math.ceil(maxU / 16) - Math.floor(minU / 16) + 1;
        const lightmapHeight = Math.ceil(maxV / 16) - Math.floor(minV / 16) + 1;

        for (const vertex of faceVertices) {
            vertices.push(vertex[0], vertex[1], vertex[2]);

            const u = vertex[0] * texInfo.s[0] + vertex[1] * texInfo.s[1] + vertex[2] * texInfo.s[2] + texInfo.sOffset;
            const v = vertex[0] * texInfo.t[0] + vertex[1] * texInfo.t[1] + vertex[2] * texInfo.t[2] + texInfo.tOffset;
            textureCoords.push(u / texture.width, v / texture.height);

            const lu = u - minU;
            const lv = v - minV;
            lightmapCoords.push(lu / (lightmapWidth * 16), lv / (lightmapHeight * 16));
        }

        for (let j = 1; j < faceVertices.length - 1; j++) {
            indices.push(0, j, j + 1);
        }

        surfaces.push({
            vertices,
            textureCoords,
            lightmapCoords,
            indices,
            texture: texInfo.texture,
            surfaceFlags: texInfo.flags,
            lightmap: {
                width: lightmapWidth,
                height: lightmapHeight,
                samples: new Uint8Array(map.lightMaps.slice(face.lightOffset, face.lightOffset + lightmapWidth * lightmapHeight * 3))
            }
        });
    }

    return surfaces;
}

export class BspRenderer {
    private readonly textureCache = new Map<string, Texture2D>();

    private constructor(
        private readonly gl: WebGL2RenderingContext,
        private readonly pipeline: BspSurfacePipeline,
        private readonly surfaces: readonly BspSurfaceGeometry[],
        private readonly lightmaps: readonly LightmapAtlas[],
    ) {}

    static async create(gl: WebGL2RenderingContext, assetManager: AssetManager, map: BspMap) {
        const textureNames = [...new Set(map.texInfo.map(ti => ti.texture))];
        const textureCache = new Map<string, PreparedTexture>();
        for (const name of textureNames) {
            const texture = await assetManager.loadTexture(name);
            textureCache.set(name, texture);
        }

        const surfaces = extractBspSurfaces(map, textureCache);
        const { surfaces: bspSurfaces, lightmaps } = buildBspGeometry(gl, surfaces);

        const pipeline = new BspSurfacePipeline(gl);

        const renderer = new BspRenderer(gl, pipeline, bspSurfaces, lightmaps);

        for (const name of textureNames) {
            const prepared = textureCache.get(name);
            if (!prepared) {
                continue;
            }
            const texture = new Texture2D(gl);
            texture.uploadImage(0, gl.RGBA, prepared.width, prepared.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, prepared.levels[0].rgba);
            renderer.textureCache.set(name, texture);
        }

        return renderer;
    }

    render(camera: Camera, map: BspMap) {
        const frustum = camera.frustum;
        const visibleFaces = gatherVisibleFaces(map, camera.position, frustum);

        const projectionMatrix = camera.projectionMatrix;
        const viewMatrix = camera.viewMatrix;
        const modelViewProjection = multiplyMat4(projectionMatrix, viewMatrix);

        for (const { faceIndex } of visibleFaces) {
            const surface = this.surfaces[faceIndex];
            if (!surface) {
                continue;
            }

            const state = this.pipeline.bind({
                modelViewProjection,
                surfaceFlags: surface.surfaceFlags,
            });

            applySurfaceState(this.gl, state);

            const texture = this.textureCache.get(surface.texture);
            if (texture) {
                texture.bind();
            }

            if (surface.lightmap) {
                this.gl.activeTexture(this.gl.TEXTURE1);
                this.lightmaps[surface.lightmap.atlasIndex].texture.bind();
            }

            surface.vao.bind();
            surface.indexBuffer.bind();
            this.gl.drawElements(this.gl.TRIANGLES, surface.indexCount, this.gl.UNSIGNED_SHORT, 0);
        }
    }
}
