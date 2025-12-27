// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PakLoaderUI } from '../../src/ui/pakLoader.js';

describe('PakLoaderUI', () => {
  let container: HTMLElement;

  beforeEach(() => {
    // JSDOM setup for container
    if (typeof document !== 'undefined') {
        container = document.createElement('div');
    } else {
        container = {
            innerHTML: '',
            querySelector: vi.fn().mockImplementation((selector) => {
                if (selector === 'h1') return { textContent: 'Quake II TS' };
                if (selector === '#drop-zone') return {
                    addEventListener: vi.fn(),
                    style: {},
                    click: vi.fn()
                };
                if (selector === '#pak-input') return {
                    files: [],
                    click: vi.fn(),
                    addEventListener: vi.fn(),
                    value: ''
                };
                if (selector === '#pak-list') return { innerHTML: '' };
                if (selector === '#start-button') return {
                    disabled: true,
                    style: {},
                    addEventListener: vi.fn(),
                    click: vi.fn()
                };
                return null;
            }),
            appendChild: vi.fn(),
            removeChild: vi.fn()
        } as any;
    }
  });

  it('should load .pak files via handleFileSelect', async () => {
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
    (files as any)[Symbol.iterator] = function* () { yield mockFile; };

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
      (files as any)[Symbol.iterator] = function* () { yield mockFile; };

      const count = await loader.handleFileSelect(files);

      expect(count).toBe(0);
      expect(onLoad).not.toHaveBeenCalled();
  });

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

      // In JSDOM, innerHTML update reflects. In mock, we check querySelector('#pak-list') innerHTML.
      // But querySelector mock returns static object.
      // We need to capture the reference for '#pak-list' to check updates if mocking.

      const pakListMock = { innerHTML: '' };
      if (typeof document === 'undefined') {
          (container.querySelector as any).mockImplementation((selector: string) => {
              if (selector === '#pak-list') return pakListMock;
              // ... other selectors
              if (selector === 'h1') return { textContent: 'Quake II TS' };
              if (selector === '#drop-zone') return { addEventListener: vi.fn(), style: {}, click: vi.fn() };
              if (selector === '#pak-input') return { files: [], click: vi.fn(), addEventListener: vi.fn(), value: '' };
              if (selector === '#start-button') return { disabled: true, style: {}, addEventListener: vi.fn(), click: vi.fn() };
              return null;
          });
      }

      const list = container.querySelector('#pak-list');
      // If mock, pakListMock should have been updated by logic (if logic holds reference)
      // PakLoaderUI: this.pakList = container.querySelector(...)
      // So it holds the returned object.

      // We expect the list to contain the file info.
      // If real DOM, it works. If mock, pakListMock.innerHTML should match.

      const content = list?.innerHTML;
      expect(content).toContain('pak0.pak');
      expect(content).toContain('1.0 MB');

      const btn = container.querySelector('#start-button') as HTMLButtonElement;
      expect(btn.disabled).toBe(false);
  });
});
