import { describe, expect, it } from 'vitest';
import { AssetPreviewGenerator } from '../../src/assets/preview.js';

describe('AssetPreviewGenerator', () => {
  const generator = new AssetPreviewGenerator();

  it('getMapBounds returns null for invalid data', async () => {
    const bounds = await generator.getMapBounds('test.bsp', new ArrayBuffer(10));
    expect(bounds).toBeNull();
  });

  // Note: Testing successful map bounds requires a valid BSP buffer, which is complex to mock here without a fixture.
  // We rely on integration tests or the fact that parseBsp is tested elsewhere.
  // Ideally we'd construct a minimal valid BSP header + model[0].
});
