import { test } from '../../helpers/visual-testing';

test('renders clear color', async ({ renderAndExpectSnapshot }) => {
  await renderAndExpectSnapshot(
    async (device) => {
      // Return the render function
      return (pass) => {
        // Pass does nothing, just clears to transparent black
      };
    },
    'clear-default'
  );
});

test('renders simple triangle', async ({ renderAndExpectSnapshot }) => {
  await renderAndExpectSnapshot(
    async (device) => {
      // Create pipeline
      const pipeline = device.createRenderPipeline({
        layout: 'auto',
        vertex: {
          module: device.createShaderModule({
            code: `
              @vertex
              fn main(@builtin(vertex_index) VertexIndex : u32)
                   -> @builtin(position) vec4<f32> {
                var pos = array<vec2<f32>, 3>(
                    vec2<f32>( 0.0,  0.5),
                    vec2<f32>(-0.5, -0.5),
                    vec2<f32>( 0.5, -0.5)
                );
                return vec4<f32>(pos[VertexIndex], 0.0, 1.0);
              }
            `,
          }),
          entryPoint: 'main',
        },
        fragment: {
          module: device.createShaderModule({
            code: `
              @fragment
              fn main() -> @location(0) vec4<f32> {
                return vec4<f32>(1.0, 0.0, 0.0, 1.0);
              }
            `,
          }),
          entryPoint: 'main',
          targets: [
            {
              format: 'rgba8unorm', // Match the format in createRenderTestSetup
            },
          ],
        },
        primitive: {
          topology: 'triangle-list',
        },
      });

      // Return render function
      return (pass) => {
        pass.setPipeline(pipeline);
        pass.draw(3);
      };
    },
    'triangle-simple'
  );
});
