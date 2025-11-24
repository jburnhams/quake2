<<<<<<< HEAD
<<<<<<< HEAD
import { describe, it, expect, vi } from 'vitest';
import { PakLoaderUI } from '../../src/ui/pakLoader.js';

describe('PakLoaderUI', () => {
  it('should load .pak files', async () => {
=======
=======
>>>>>>> origin/main
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PakLoaderUI } from '../../src/ui/pakLoader.js';

describe('PakLoaderUI', () => {
  let container: HTMLElement;

  beforeEach(() => {
    // JSDOM setup for container
    container = document.createElement('div');
  });

  it('should load .pak files via handleFileSelect', async () => {
<<<<<<< HEAD
>>>>>>> 40ca6857d501c73b890d6872b901150001e7151e
=======
>>>>>>> origin/main
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
<<<<<<< HEAD
<<<<<<< HEAD
=======
    (files as any)[Symbol.iterator] = function* () { yield mockFile; };
>>>>>>> 40ca6857d501c73b890d6872b901150001e7151e
=======
    (files as any)[Symbol.iterator] = function* () { yield mockFile; };
>>>>>>> origin/main

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
<<<<<<< HEAD
<<<<<<< HEAD
=======
      (files as any)[Symbol.iterator] = function* () { yield mockFile; };
>>>>>>> 40ca6857d501c73b890d6872b901150001e7151e
=======
      (files as any)[Symbol.iterator] = function* () { yield mockFile; };
>>>>>>> origin/main

      const count = await loader.handleFileSelect(files);

      expect(count).toBe(0);
      expect(onLoad).not.toHaveBeenCalled();
  });
<<<<<<< HEAD
<<<<<<< HEAD
=======
=======
>>>>>>> origin/main

  it('should render UI when mounted', () => {
      const onLoad = vi.fn();
      const loader = new PakLoaderUI(onLoad);
      loader.mount(container);

      expect(container.querySelector('h1')?.textContent).toBe('Quake II TS');
      expect(container.querySelector('#drop-zone')).not.toBeNull();
      expect(container.querySelector('#start-button')).not.toBeNull();
  });

  it('should update list when files loaded', async () => {
      const onLoad = vi.fn().mockResolvedValue(undefined);
      const loader = new PakLoaderUI(onLoad);
      loader.mount(container);

      const mockFile = {
          name: 'pak0.pak',
          size: 1024 * 1024, // 1MB
          arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(1024))
      };

      const files = [mockFile] as any as FileList;
      files.item = (i) => files[i];
      (files as any).length = 1;
      (files as any)[Symbol.iterator] = function* () { yield mockFile; };

      await loader.handleFileSelect(files);

      const list = container.querySelector('#pak-list');
      expect(list?.innerHTML).toContain('pak0.pak');
      expect(list?.innerHTML).toContain('1.0 MB');

      const btn = container.querySelector('#start-button') as HTMLButtonElement;
      expect(btn.disabled).toBe(false);
  });
<<<<<<< HEAD
>>>>>>> 40ca6857d501c73b890d6872b901150001e7151e
=======
>>>>>>> origin/main
});
