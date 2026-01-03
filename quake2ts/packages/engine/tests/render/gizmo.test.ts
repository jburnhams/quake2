import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Gizmo, GizmoPart, Ray } from '../../src/render/gizmo.js';
import { DebugRenderer } from '../../src/render/debug.js';

describe('Gizmo', () => {
    let gizmo: Gizmo;
    let renderer: DebugRenderer;
    let gl: WebGL2RenderingContext;

    beforeEach(() => {
        gl = {
            createShader: vi.fn(() => ({})),
            shaderSource: vi.fn(),
            compileShader: vi.fn(),
            getShaderParameter: vi.fn(() => true),
            createProgram: vi.fn(() => ({})),
            attachShader: vi.fn(),
            linkProgram: vi.fn(),
            getProgramParameter: vi.fn(() => true),
            useProgram: vi.fn(),
            getUniformLocation: vi.fn(),
            getAttribLocation: vi.fn(),
            createVertexArray: vi.fn(() => ({})),
            bindVertexArray: vi.fn(),
            createBuffer: vi.fn(() => ({})),
            bindBuffer: vi.fn(),
            bufferData: vi.fn(),
            enableVertexAttribArray: vi.fn(),
            vertexAttribPointer: vi.fn(),
            drawArrays: vi.fn(),
            enable: vi.fn(),
            disable: vi.fn(),
            deleteShader: vi.fn(),
            deleteProgram: vi.fn(),
            FLOAT: 5126,
            DYNAMIC_DRAW: 35048,
            LINES: 1,
            TRIANGLES: 4,
            DEPTH_TEST: 2929,
            VERTEX_SHADER: 35633,
            FRAGMENT_SHADER: 35632,
        } as unknown as WebGL2RenderingContext;

        renderer = new DebugRenderer(gl);
        vi.spyOn(renderer, 'drawLine');
        vi.spyOn(renderer, 'addCone');
        vi.spyOn(renderer, 'addTorus');

        gizmo = new Gizmo();
    });

    it('should draw all parts', () => {
        gizmo.draw(renderer, GizmoPart.None);
        expect(renderer.drawLine).toHaveBeenCalledTimes(3);
        expect(renderer.addCone).toHaveBeenCalledTimes(3);
        // Expect 3 torus calls now
        expect(renderer.addTorus).toHaveBeenCalledTimes(3);
    });

    it('should update position', () => {
        gizmo.setPosition({x: 10, y: 20, z: 30});
        gizmo.draw(renderer);
        expect(renderer.drawLine).toHaveBeenCalledWith(
            expect.objectContaining({x: 10, y: 20, z: 30}), // Start
            expect.any(Object),
            expect.any(Object)
        );
    });

    describe('Picking', () => {
        it('should pick X axis', () => {
            const ray: Ray = {
                origin: { x: 5, y: -10, z: 0 },
                direction: { x: 0, y: 1, z: 0 }
            };
            const hit = gizmo.intersect(ray);
            expect(hit).toBe(GizmoPart.XAxis);
        });

        it('should pick Y axis', () => {
             const ray: Ray = {
                origin: { x: 0, y: 5, z: -10 },
                direction: { x: 0, y: 0, z: 1 }
            };
            const hit = gizmo.intersect(ray);
            expect(hit).toBe(GizmoPart.YAxis);
        });

        it('should pick Z axis', () => {
             const ray: Ray = {
                origin: { x: -10, y: 0, z: 5 },
                direction: { x: 1, y: 0, z: 0 }
            };
            const hit = gizmo.intersect(ray);
            expect(hit).toBe(GizmoPart.ZAxis);
        });

        it('should pick Z ring', () => {
            const x = 7.071;
            const y = 7.071;
            const ray: Ray = {
                origin: { x: x, y: y, z: 10 },
                direction: { x: 0, y: 0, z: -1 }
            };
            const hit = gizmo.intersect(ray);
            expect(hit).toBe(GizmoPart.ZRing);
        });

        it('should pick X ring', () => {
            // X Ring is in YZ plane.
            // Point (0, 7.071, 7.071)
            const y = 7.071;
            const z = 7.071;
            const ray: Ray = {
                origin: { x: 10, y: y, z: z },
                direction: { x: -1, y: 0, z: 0 }
            };
            const hit = gizmo.intersect(ray);
            expect(hit).toBe(GizmoPart.XRing);
        });

        it('should pick Y ring', () => {
            // Y Ring is in XZ plane.
            // Point (7.071, 0, 7.071)
            const x = 7.071;
            const z = 7.071;
            const ray: Ray = {
                origin: { x: x, y: 10, z: z },
                direction: { x: 0, y: -1, z: 0 }
            };
            const hit = gizmo.intersect(ray);
            expect(hit).toBe(GizmoPart.YRing);
        });

        it('should return null for miss', () => {
            const ray: Ray = {
                origin: { x: 20, y: 20, z: 20 },
                direction: { x: 0, y: 1, z: 0 }
            };
            const hit = gizmo.intersect(ray);
            expect(hit).toBeNull();
        });
    });
});
