import { DemoPackager, DemoPackage, PackageOptions } from './packager.js';
import { DemoClipper } from './clipper.js';
import { OptimalClipFinder, OptimalWindow, OptimizationCriteria } from './optimalClipFinder.js';
import { DemoAnalyzer } from './analyzer.js';
import { VirtualFileSystem } from '../assets/vfs.js';
import { PakArchive } from '../assets/pak.js';
import { Offset } from './types.js';
import { DemoPlaybackController } from './playback.js';
import { ResourceVisibilityAnalyzer } from '../assets/visibilityAnalyzer.js';

export interface ClipCriteria {
    duration: number; // Seconds
    maxResources?: number;
    minAction?: number;
}

export interface DemoAnalysisReport {
    summary: {
        duration: number;
        totalResources: number;
    };
    optimalWindows: OptimalWindow[];
    // Future: events, heatmaps
}

export class DemoOptimizerApi {
    private packager: DemoPackager;
    private clipFinder: OptimalClipFinder;
    private clipper: DemoClipper;

    constructor() {
        this.packager = new DemoPackager();
        this.clipFinder = new OptimalClipFinder();
        this.clipper = new DemoClipper();
    }

    /**
     * Create a raw demo clip from a demo file.
     */
    public async createDemoClip(demoData: Uint8Array, startTime: number, duration: number): Promise<Uint8Array> {
        // Convert time to frames? Or use TimeOffset directly.
        // Clipper uses Offset.
        // We assume we can pass time offsets if supported, otherwise we might need frame conversion.
        // Task 2.1 added TimeOffset support.
        const start: Offset = { type: 'time', seconds: startTime };
        const end: Offset = { type: 'time', seconds: startTime + duration };

        const controller = new DemoPlaybackController();
        controller.loadDemo(demoData.buffer as ArrayBuffer);

        return this.clipper.extractClip(demoData, start, end, controller);
    }

    /**
     * Create an optimized package (clip + PAK) containing only necessary assets.
     */
    public async createOptimalDemoPackage(
        demoData: Uint8Array,
        pakFiles: { name: string, data: Uint8Array }[],
        criteria: ClipCriteria
    ): Promise<DemoPackage> {
        // 1. Setup VFS
        const vfs = new VirtualFileSystem();
        for (const pak of pakFiles) {
            // We need to mount the PAK.
            // VFS supports mounting archives.
            // But here we have raw data. We should parse it into PakArchive first.
            const archive = PakArchive.fromArrayBuffer(pak.name, pak.data.buffer as ArrayBuffer);
            vfs.mountPak(archive);
        }

        // 2. Prepare options
        const options: PackageOptions = {
            demoSource: demoData,
            sourcePaks: vfs,
            optimize: {
                durationRange: [criteria.duration, criteria.duration + 5], // Allow small flexibility
                maxResources: criteria.maxResources
            },
            level: 'SAFE' // Default to safe
        };

        // 3. Execute
        return this.packager.extractDemoPackage(options);
    }

    /**
     * Analyze a demo to find resource usage and optimal windows.
     */
    public async analyzeDemo(demoData: Uint8Array): Promise<DemoAnalysisReport> {
        // Analyze for a standard window size (e.g. 60s) just to give some suggestions
        const criteria: OptimizationCriteria = {
            durationRange: [30, 60]
        };

        const visibilityAnalyzer = new ResourceVisibilityAnalyzer();
        const timeline = await visibilityAnalyzer.analyzeDemo(demoData);

        const windows = await this.clipFinder.findOptimalWindows(timeline, criteria);

        // Use Analyzer for summary stats (duration, etc.)
        const analyzer = new DemoAnalyzer(demoData.buffer as ArrayBuffer);
        const stats = analyzer.analyze();

        return {
            summary: {
                duration: stats.statistics?.duration || 0,
                totalResources: 0 // TODO: Get total unique resources from stats or visibility analyzer
            },
            optimalWindows: windows
        };
    }

    /**
     * Find best clips based on specific criteria.
     */
    public async findBestClips(demoData: Uint8Array, criteria: ClipCriteria): Promise<OptimalWindow[]> {
        const optCriteria: OptimizationCriteria = {
            durationRange: [criteria.duration, criteria.duration + 10],
            maxResources: criteria.maxResources
            // Content criteria scoring not directly mapped in OptimizationCriteria basic structure
            // Use scoringMode 'action' or 'hybrid' instead if available, or update OptimizationCriteria definition
        };

        // Setup options to include analysis for action scoring
        const options: any = { // TODO: Properly type this
            ...optCriteria,
            scoringMode: criteria.minAction ? 'hybrid' : 'count',
            demoBuffer: demoData.buffer as ArrayBuffer
        };

        const visibilityAnalyzer = new ResourceVisibilityAnalyzer();
        const timeline = await visibilityAnalyzer.analyzeDemo(demoData);

        return this.clipFinder.findOptimalWindows(timeline, options);
    }
}
