import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DemoMenuFactory } from '../../../src/ui/menu/demo.js';
import { MenuSystem } from '../../../src/ui/menu/system.js';
import { ClientExports } from '../../../src/index.js';
import { DemoValidator } from '@quake2ts/engine';

// Mock DemoValidator
vi.mock('@quake2ts/engine', async () => {
    const actual = await vi.importActual('@quake2ts/engine');
    return {
        ...actual,
        DemoValidator: {
            validate: vi.fn().mockReturnValue({ valid: true })
        }
    };
});

describe('DemoMenuFactory', () => {
  let menuSystem: MenuSystem;
  let client: ClientExports;
  let factory: DemoMenuFactory;

  // Mock document.body.appendChild and removeChild
  const originalAppendChild = document.body.appendChild;
  const originalRemoveChild = document.body.removeChild;
  let mockInput: any;

  beforeEach(() => {
    menuSystem = new MenuSystem();
    client = {
      startDemoPlayback: vi.fn(),
      errorDialog: {
        show: vi.fn(),
        render: vi.fn()
      }
    } as unknown as ClientExports;

    factory = new DemoMenuFactory(menuSystem, client);

    // Mock file input creation
    mockInput = {
        type: 'file',
        style: { display: 'none' },
        click: vi.fn(),
        files: [],
        accept: ''
    };

    // We need to intercept createElement('input')
    const originalCreateElement = document.createElement;
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
        if (tagName === 'input') return mockInput;
        return originalCreateElement.call(document, tagName);
    });

    document.body.appendChild = vi.fn();
    document.body.removeChild = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.body.appendChild = originalAppendChild;
    document.body.removeChild = originalRemoveChild;
  });

  it('should create a demo menu structure', () => {
    const menu = factory.createDemoMenu();
    expect(menu.title).toBe('Demos');
    expect(menu.items.length).toBeGreaterThan(0);

    // Check for "Load Demo File..."
    const loadItem = menu.items.find(i => i.label === 'Load Demo File...');
    expect(loadItem).toBeDefined();

    // Check for "Back"
    const backItem = menu.items.find(i => i.label === 'Back');
    expect(backItem).toBeDefined();
  });

  it('should handle Load Demo File action via callback if provided', async () => {
      const onLoadDemoFile = vi.fn().mockResolvedValue(undefined);
      factory = new DemoMenuFactory(menuSystem, client, { onLoadDemoFile });

      const menu = factory.createDemoMenu();
      const loadItem = menu.items.find(i => i.label === 'Load Demo File...');

      await loadItem?.action();

      expect(onLoadDemoFile).toHaveBeenCalled();
  });

  it('should pop menu on Back action', () => {
      const spy = vi.spyOn(menuSystem, 'popMenu');
      const menu = factory.createDemoMenu();
      const backItem = menu.items.find(i => i.label === 'Back');

      backItem?.action();
      expect(spy).toHaveBeenCalled();
  });

  it('should show error dialog if demo validation fails', async () => {
      // Setup validation failure
      vi.mocked(DemoValidator.validate).mockReturnValue({ valid: false, error: 'Bad file' });

      const menu = factory.createDemoMenu();
      const loadItem = menu.items.find(i => i.label === 'Load Demo File...');

      // Trigger action
      loadItem?.action();

      // Simulate file selection
      const blob = new Blob(['fake demo content'], { type: 'application/octet-stream' });
      const file = new File([blob], 'bad.dm2');
      // Mock arrayBuffer specifically for jsdom/test env if File doesn't support it directly
      file.arrayBuffer = vi.fn().mockResolvedValue(new ArrayBuffer(10));

      mockInput.files = [file];

      // Trigger change event
      await mockInput.onchange();

      expect(DemoValidator.validate).toHaveBeenCalled();
      expect(client.errorDialog.show).toHaveBeenCalledWith("Invalid Demo File", "Bad file");
      expect(client.startDemoPlayback).not.toHaveBeenCalled();
  });

  it('should start playback if demo validation passes', async () => {
      // Setup validation success
      vi.mocked(DemoValidator.validate).mockReturnValue({ valid: true });

      const menu = factory.createDemoMenu();
      const loadItem = menu.items.find(i => i.label === 'Load Demo File...');

      // Trigger action
      loadItem?.action();

      // Simulate file selection
      const blob = new Blob(['valid demo content'], { type: 'application/octet-stream' });
      const file = new File([blob], 'good.dm2');
      // Mock arrayBuffer
      file.arrayBuffer = vi.fn().mockResolvedValue(new ArrayBuffer(10));

      mockInput.files = [file];

      // Trigger change event
      await mockInput.onchange();

      expect(DemoValidator.validate).toHaveBeenCalled();
      expect(client.startDemoPlayback).toHaveBeenCalled();
      expect(client.errorDialog.show).not.toHaveBeenCalled();
  });
});
