import { ResourceVisibilityAnalyzer, VisibilityTimeline } from './visibilityAnalyzer.js';
import { AssetManager } from './manager.js';

export interface ResourceGraph {
    nodes: Set<string>;
    // Map from resource -> dependencies (outgoing edges)
    edges: Map<string, Set<string>>;
    // Reverse edges for convenience (dependency -> used by)
    reverseEdges: Map<string, Set<string>>;
}

export class ResourceInteractionGraph {
    private graph: ResourceGraph;

    constructor() {
        this.graph = {
            nodes: new Set(),
            edges: new Map(),
            reverseEdges: new Map()
        };
    }

    public getGraph(): ResourceGraph {
        return this.graph;
    }

    public async buildGraph(timeline: VisibilityTimeline, assetManager: AssetManager): Promise<ResourceGraph> {
        this.clear();

        // 1. Collect all root resources from timeline
        for (const frame of timeline.frames.values()) {
            for (const model of frame.models) {
                this.addNode(model);
            }
            for (const sound of frame.sounds) {
                this.addNode(sound);
            }
            // If textures were already populated (e.g. from BSP analysis in future), add them
            for (const texture of frame.textures) {
                this.addNode(texture);
            }
        }

        // 2. Resolve dependencies
        // Iterate over a copy of nodes because we might add new nodes (dependencies)
        const processingQueue = Array.from(this.graph.nodes);
        const processed = new Set<string>();

        while (processingQueue.length > 0) {
            const resource = processingQueue.shift()!;
            if (processed.has(resource)) continue;
            processed.add(resource);

            const dependencies = await this.resolveDependencies(resource, assetManager);
            for (const dep of dependencies) {
                this.addDependency(resource, dep);
                if (!processed.has(dep)) {
                    processingQueue.push(dep);
                }
            }
        }

        return this.graph;
    }

    public getTransitiveDependencies(resource: string): Set<string> {
        const dependencies = new Set<string>();
        const visit = (res: string) => {
            const deps = this.graph.edges.get(res);
            if (deps) {
                for (const dep of deps) {
                    if (!dependencies.has(dep)) {
                        dependencies.add(dep);
                        visit(dep);
                    }
                }
            }
        };
        visit(resource);
        return dependencies;
    }

    public getMinimalSetForFrame(frame: number, timeline: VisibilityTimeline): Set<string> {
        const frameResources = timeline.frames.get(frame);
        if (!frameResources) return new Set();

        const minimalSet = new Set<string>();
        const addWithDeps = (res: string) => {
            minimalSet.add(res);
            const deps = this.getTransitiveDependencies(res);
            for (const d of deps) minimalSet.add(d);
        };

        for (const m of frameResources.models) addWithDeps(m);
        for (const s of frameResources.sounds) addWithDeps(s);
        for (const t of frameResources.textures) addWithDeps(t);

        return minimalSet;
    }

    public getMinimalSetForRange(start: number, end: number, timeline: VisibilityTimeline): Set<string> {
        const minimalSet = new Set<string>();
        // Iterate frames in timeline within range
        for (const [frameNum, _] of timeline.frames) {
            if (frameNum >= start && frameNum <= end) {
                const frameSet = this.getMinimalSetForFrame(frameNum, timeline);
                for (const res of frameSet) {
                    minimalSet.add(res);
                }
            }
        }
        return minimalSet;
    }

    private clear(): void {
        this.graph.nodes.clear();
        this.graph.edges.clear();
        this.graph.reverseEdges.clear();
    }

    private addNode(resource: string): void {
        this.graph.nodes.add(resource);
    }

    private addDependency(from: string, to: string): void {
        this.addNode(from);
        this.addNode(to);

        if (!this.graph.edges.has(from)) {
            this.graph.edges.set(from, new Set());
        }
        this.graph.edges.get(from)!.add(to);

        if (!this.graph.reverseEdges.has(to)) {
            this.graph.reverseEdges.set(to, new Set());
        }
        this.graph.reverseEdges.get(to)!.add(from);
    }

    private async resolveDependencies(resource: string, assetManager: AssetManager): Promise<Set<string>> {
        const deps = new Set<string>();
        const lowerRes = resource.toLowerCase();

        if (lowerRes.endsWith('.md2')) {
            try {
                const model = await assetManager.loadMd2Model(resource);
                if (model && model.skins) {
                    for (const skin of model.skins) {
                        if (skin.name && skin.name.trim().length > 0) {
                            deps.add(skin.name);
                        }
                    }
                }
            } catch (e) {
                console.warn(`Failed to resolve dependencies for ${resource}: ${e}`);
            }
        }
        return deps;
    }
}
