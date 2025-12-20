import { VisibilityTimeline } from '../assets/visibilityAnalyzer.js';
import { Offset, FrameOffset, TimeOffset } from './types.js';
import { DemoAnalyzer } from './analyzer.js';
import { DemoEventType } from './analysis.js';

export interface OptimalWindow {
    start: Offset;
    end: Offset;
    resourceCount: number;
    resources: Set<string>;
    score: number;
}

export type ScoringMode = 'count' | 'size' | 'locality' | 'hybrid' | 'action';

export interface OptimizationCriteria {
    durationRange?: [number, number]; // [min, max] seconds
    maxResources?: number;
    scoringMode?: ScoringMode;
    resourceSizes?: Map<string, number>;
    topN?: number;
}

export interface OptimizationOptions extends OptimizationCriteria {
    analyzer?: DemoAnalyzer;
    demoBuffer?: ArrayBuffer;
    searchStart?: number; // Time in seconds
    searchEnd?: number;   // Time in seconds
}

export class OptimalClipFinder {

    public async findOptimalWindows(
        timeline: VisibilityTimeline,
        criteria: OptimizationOptions
    ): Promise<OptimalWindow[]> {
        const minDur = criteria.durationRange ? criteria.durationRange[0] : 60;
        const maxDur = criteria.durationRange ? criteria.durationRange[1] : minDur;

        const allCandidates: OptimalWindow[] = [];

        // If min == max, single pass.
        // If range, sample durations.
        const durations = new Set<number>();
        durations.add(minDur);
        durations.add(maxDur);
        // Add sampling if range is large? For now just endpoints.

        for (const dur of durations) {
            const wins = this.scanTimeline(timeline, dur, criteria);
            allCandidates.push(...wins);
        }

        // Sort: Lower score is better
        allCandidates.sort((a, b) => a.score - b.score);

        // Filter Constraints
        const filtered = allCandidates.filter(w => {
            if (criteria.maxResources && w.resourceCount > criteria.maxResources) return false;
            return true;
        });

        // Select Top N Non-Overlapping
        const result: OptimalWindow[] = [];
        const topN = criteria.topN || 1;

        for (const cand of filtered) {
            if (result.length >= topN) break;

            let overlap = false;
            const candStart = (cand.start as any).seconds;
            const candEnd = (cand.end as any).seconds;

            for (const existing of result) {
                const exStart = (existing.start as any).seconds;
                const exEnd = (existing.end as any).seconds;

                // Simple overlap check
                if (Math.max(candStart, exStart) < Math.min(candEnd, exEnd)) {
                    overlap = true;
                    break;
                }
            }

            if (!overlap) {
                result.push(cand);
            }
        }

        return result;
    }

    public findMinimalWindow(
        timeline: VisibilityTimeline,
        duration: number,
        options: OptimizationOptions = {}
    ): OptimalWindow {
        const wins = this.scanTimeline(timeline, duration, options);
        if (wins.length === 0) throw new Error("No valid window found");

        // Sort ascending score
        wins.sort((a, b) => a.score - b.score);
        return wins[0];
    }

    public findMinimalWindowInRange(
        timeline: VisibilityTimeline,
        duration: number,
        searchStart?: Offset,
        searchEnd?: Offset
    ): OptimalWindow {
        const startT = searchStart && searchStart.type === 'time' ? searchStart.seconds :
                       (searchStart && searchStart.type === 'frame' ? this.estimateTime(searchStart.frame, timeline) : undefined);

        const endT = searchEnd && searchEnd.type === 'time' ? searchEnd.seconds :
                     (searchEnd && searchEnd.type === 'frame' ? this.estimateTime(searchEnd.frame, timeline) : undefined);

        return this.findMinimalWindow(timeline, duration, { searchStart: startT, searchEnd: endT });
    }

    private estimateTime(frame: number, timeline: VisibilityTimeline): number {
        // Fallback or lookup
        // Assuming 10hz if not map
        return frame * 0.1;
    }

    private scanTimeline(timeline: VisibilityTimeline, duration: number, options: OptimizationOptions): OptimalWindow[] {
        const timePoints = Array.from(timeline.time.keys()).sort((a, b) => a - b);
        if (timePoints.length === 0) return [];

        const windows: OptimalWindow[] = [];

        let right = 0;
        const currentResources = new Map<string, number>();

        // Analyze events if needed
        let events: any[] = [];
        const scoringMode = options.scoringMode || 'count';
        if (scoringMode === 'action' || scoringMode === 'hybrid') {
             if (options.analyzer) {
                 events = options.analyzer.analyze().events;
             } else if (options.demoBuffer) {
                 const analyzer = new DemoAnalyzer(options.demoBuffer);
                 events = analyzer.analyze().events;
             }
             events.sort((a, b) => a.time - b.time);
        }

        const resourceSizes = options.resourceSizes || new Map();

        // Iterate
        for (let i = 0; i < timePoints.length; i++) {
            const startTime = timePoints[i];

            // Check Range
            if (options.searchStart !== undefined && startTime < options.searchStart) continue;
            if (options.searchEnd !== undefined && startTime > options.searchEnd) break; // Optimization: sorted keys

            const endTime = startTime + duration;

            // Advance right
            while (right < timePoints.length && timePoints[right] <= endTime) {
                const t = timePoints[right];
                const res = timeline.time.get(t);
                if (res) {
                    this.addResources(currentResources, res.models);
                    this.addResources(currentResources, res.sounds);
                    this.addResources(currentResources, res.textures);
                }
                right++;
            }

            // Score
            const uniqueResources = new Set(currentResources.keys());
            let score = 0;

            if (scoringMode === 'count') {
                score = uniqueResources.size;
            } else if (scoringMode === 'size') {
                for (const res of uniqueResources) {
                    score += resourceSizes.get(res) || 0;
                }
            } else if (scoringMode === 'action') {
                const actionScore = this.calculateActionScore(events, startTime, endTime);
                score = -actionScore;
            } else if (scoringMode === 'hybrid') {
                const actionScore = this.calculateActionScore(events, startTime, endTime);
                score = uniqueResources.size - actionScore;
            } else {
                score = uniqueResources.size;
            }

            // Store Candidate
            // Optimization: Don't store every single millisecond shift. Store local minima or sample.
            // For now, store all, filter later.
            // Actually, storing ALL is too memory intensive for large demos.
            // Let's store only if it's "better" than recent or a local minimum.

            windows.push({
                start: { type: 'time', seconds: startTime },
                end: { type: 'time', seconds: endTime },
                resourceCount: uniqueResources.size,
                resources: new Set(uniqueResources), // clone
                score: score
            });

            // Remove left
            const t = timePoints[i];
            const res = timeline.time.get(t);
            if (res) {
                this.removeResources(currentResources, res.models);
                this.removeResources(currentResources, res.sounds);
                this.removeResources(currentResources, res.textures);
            }
        }

        return windows;
    }

    private calculateActionScore(events: any[], start: number, end: number): number {
        let score = 0;
        for (const event of events) {
            if (event.time >= start && event.time <= end) {
                switch (event.type) {
                    case DemoEventType.Death: score += 10; break;
                    case DemoEventType.DamageReceived: score += 1; break;
                    case DemoEventType.WeaponFire: score += 0.5; break;
                    case DemoEventType.Pickup: score += 0.2; break;
                    case DemoEventType.Chat: score += 2; break;
                    case DemoEventType.Objective: score += 5; break;
                }
            }
        }
        return score;
    }

    private addResources(counts: Map<string, number>, resources: Set<string>) {
        for (const r of resources) {
            const c = counts.get(r) || 0;
            counts.set(r, c + 1);
        }
    }

    private removeResources(counts: Map<string, number>, resources: Set<string>) {
        for (const r of resources) {
            const c = counts.get(r);
            if (c !== undefined) {
                if (c <= 1) {
                    counts.delete(r);
                } else {
                    counts.set(r, c - 1);
                }
            }
        }
    }
}
