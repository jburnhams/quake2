import { VirtualFileSystem } from '../assets/vfs.js';
import { PakWriter } from '../assets/pakWriter.js';
import { DemoClipper } from './clipper.js';
import { OptimalClipFinder, OptimizationOptions } from './optimalClipFinder.js';
import { ResourceVisibilityAnalyzer } from '../assets/visibilityAnalyzer.js';
import { Offset } from './types.js';
import { DemoPlaybackController } from './playback.js';

export interface PackageOptions {
    demoSource: Uint8Array;
    sourcePaks: VirtualFileSystem;

    // Range or optimization criteria
    range?: { start: Offset; end: Offset };
    optimize?: OptimizationOptions;

    // Optimization level
    level?: 'MINIMAL' | 'SAFE' | 'COMPLETE' | 'ULTRA';
}

export interface PackageManifest {
    metadata: {
        timestamp: number;
        originalSize: number;
        optimizedSize: number;
        duration: number;
        startFrame: number;
        endFrame: number;
        optimizationLevel: string;
    };
    resources: {
        [key: string]: {
            size: number;
            type: string;
        };
    };
}

export interface DemoPackage {
    demoData: Uint8Array;
    pakData: Uint8Array;
    manifest: PackageManifest;
}

export class DemoPackager {
    private clipper: DemoClipper;
    private clipFinder: OptimalClipFinder;
    private visibilityAnalyzer: ResourceVisibilityAnalyzer;

    constructor() {
        this.clipper = new DemoClipper();
        this.clipFinder = new OptimalClipFinder();
        this.visibilityAnalyzer = new ResourceVisibilityAnalyzer();
    }

    public async extractDemoPackage(options: PackageOptions): Promise<DemoPackage> {
        let clipData: Uint8Array;
        let startFrame = 0;
        let endFrame = 0;
        let duration = 0; // Estimate or calculate

        // 1. Determine Clip Range
        if (options.optimize) {
            // Need timeline for optimal finder
            const timeline = await this.visibilityAnalyzer.analyzeDemo(options.demoSource);
            const durationSec = options.optimize.durationRange ? options.optimize.durationRange[0] : 60;
            const optimal = this.clipFinder.findMinimalWindow(timeline, durationSec, options.optimize);

            // Extract frame range from optimal window if available, or just use offsets
            if (optimal.start.type === 'frame') startFrame = optimal.start.frame;
            else startFrame = Math.floor(optimal.start.seconds * 10); // Rough estimate if only time is known, 10hz fallback

            if (optimal.end.type === 'frame') endFrame = optimal.end.frame;
            else endFrame = Math.floor(optimal.end.seconds * 10);

            duration = (optimal.end as any).seconds - (optimal.start as any).seconds;

            const controller = new DemoPlaybackController();
            controller.loadDemo(options.demoSource.buffer as ArrayBuffer);

            clipData = this.clipper.extractClip(options.demoSource, optimal.start, optimal.end, controller);
        } else if (options.range) {
             if (options.range.start.type === 'frame') startFrame = options.range.start.frame;
             else startFrame = Math.floor(options.range.start.seconds * 10);

             if (options.range.end.type === 'frame') endFrame = options.range.end.frame;
             else endFrame = Math.floor(options.range.end.seconds * 10);

             // If range provided in seconds, calculate duration
             if (options.range.start.type === 'time' && options.range.end.type === 'time') {
                 duration = options.range.end.seconds - options.range.start.seconds;
             }

            const controller = new DemoPlaybackController();
            controller.loadDemo(options.demoSource.buffer as ArrayBuffer);

            clipData = this.clipper.extractClip(options.demoSource, options.range.start, options.range.end, controller);
        } else {
            // Full demo
            clipData = options.demoSource;
            // TODO: Parse header for duration/frames
        }

        // 2. Analyze Resources in Clip
        const timeline = await this.visibilityAnalyzer.analyzeDemo(clipData);

        // 3. Collect Resources based on Level
        const level = options.level || 'MINIMAL';
        const requiredResources = new Set<string>();

        for (const [frame, resources] of timeline.frames) {
            if (level === 'MINIMAL') {
                resources.visible.forEach(r => requiredResources.add(r));
                resources.audible.forEach(r => requiredResources.add(r));
                resources.textures.forEach(r => requiredResources.add(r));
            } else {
                resources.models.forEach(r => requiredResources.add(r));
                resources.sounds.forEach(r => requiredResources.add(r));
                resources.textures.forEach(r => requiredResources.add(r));
            }
        }

        // 4. Collect Resources from Source PAKs
        const resourceMap = await this.collectResources(requiredResources, options.sourcePaks, level);

        // 5. Build Optimized PAK
        const pakWriter = new PakWriter();
        for (const [path, data] of resourceMap) {
            pakWriter.addFile(path, data);
        }
        const pakData = pakWriter.build();

        // 6. Generate Manifest
        const manifest: PackageManifest = {
            metadata: {
                timestamp: Date.now(),
                originalSize: options.demoSource.length,
                optimizedSize: clipData.length + pakData.length,
                duration: duration,
                startFrame: startFrame,
                endFrame: endFrame,
                optimizationLevel: level
            },
            resources: {}
        };

        for (const [path, data] of resourceMap) {
            manifest.resources[path] = {
                size: data.length,
                type: this.guessResourceType(path)
            };
        }

        return {
            demoData: clipData,
            pakData,
            manifest
        };
    }

    public async collectResources(resourcePaths: Set<string>, sourcePaks: VirtualFileSystem, level: string = 'MINIMAL'): Promise<Map<string, Uint8Array>> {
        const result = new Map<string, Uint8Array>();

        for (const path of resourcePaths) {
            let data = await sourcePaks.readFile(path);

            if (data) {
                if (level === 'ULTRA') {
                    data = await this.optimizeResource(path, data);
                }
                result.set(path, data);
            } else {
                console.warn(`[DemoPackager] Missing resource: ${path}`);
            }
        }

        return result;
    }

    private async optimizeResource(path: string, data: Uint8Array): Promise<Uint8Array> {
        const type = this.guessResourceType(path);
        if (type === 'Texture') {
            return data;
        } else if (type === 'Sound') {
            return data;
        }
        return data;
    }

    private guessResourceType(path: string): string {
        const ext = path.split('.').pop()?.toLowerCase();
        switch (ext) {
            case 'bsp': return 'Map';
            case 'md2': return 'Model';
            case 'pcx':
            case 'wal':
            case 'tga': return 'Texture';
            case 'wav': return 'Sound';
            default: return 'Unknown';
        }
    }
}
