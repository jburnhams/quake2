import { describe, it, expect, vi } from 'vitest';
import { PakLoaderUI } from '../../src/ui/pakLoader.js';

describe('PakLoaderUI', () => {
  it('should load .pak files', async () => {
    const onLoad = vi.fn().mockResolvedValue(undefined);
    const loader = new PakLoaderUI(onLoad);

    const mockFile = {
        name: 'pak0.pak',
        size: 1024,
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(1024))
    };

    const files = [mockFile] as any as FileList;
    files.item = (i) => files[i];
    (files as any).length = 1;

    const count = await loader.handleFileSelect(files);

    expect(count).toBe(1);
    expect(onLoad).toHaveBeenCalled();
    expect(loader.getLoadedPaks()[0].name).toBe('pak0.pak');
  });

  it('should ignore non-pak files', async () => {
      const onLoad = vi.fn();
      const loader = new PakLoaderUI(onLoad);

      const mockFile = {
        name: 'image.png',
        size: 1024,
        arrayBuffer: vi.fn()
      };

      const files = [mockFile] as any as FileList;
      (files as any).length = 1;
      files.item = (i) => files[i];

      const count = await loader.handleFileSelect(files);

      expect(count).toBe(0);
      expect(onLoad).not.toHaveBeenCalled();
  });
});
