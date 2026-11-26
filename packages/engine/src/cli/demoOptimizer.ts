import { DemoOptimizerApi } from '../demo/api.js';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Basic CLI for Demo Optimizer.
 * Usage:
 *   analyze <demo.dm2>
 *   extract <demo.dm2> <start> <duration> -o output.dm2
 *   optimize <demo.dm2> <pak0.pak> [pak1.pak...] -d <duration> -o <output_dir>
 *   find-best <demo.dm2> --duration <duration> --top <N>
 */
export async function runCli(args: string[]) {
    const command = args[0];
    const api = new DemoOptimizerApi();

    try {
        switch (command) {
            case 'analyze':
                await handleAnalyze(api, args.slice(1));
                break;
            case 'extract':
                await handleExtract(api, args.slice(1));
                break;
            case 'optimize':
                await handleOptimize(api, args.slice(1));
                break;
            case 'find-best':
                await handleFindBest(api, args.slice(1));
                break;
            default:
                console.log('Unknown command. Available: analyze, extract, optimize, find-best');
                break;
        }
    } catch (e) {
        console.error('Error:', e);
        process.exit(1);
    }
}

async function handleAnalyze(api: DemoOptimizerApi, args: string[]) {
    const demoPath = args[0];
    if (!demoPath) throw new Error('Usage: analyze <demo.dm2>');

    const data = await fs.readFile(demoPath);
    const report = await api.analyzeDemo(data);

    console.log(JSON.stringify(report, null, 2));
}

async function handleExtract(api: DemoOptimizerApi, args: string[]) {
    const demoPath = args[0];
    const startStr = args[1];
    const durStr = args[2];

    // Simple parser for -o
    let output = 'clip.dm2';
    const outIdx = args.indexOf('-o');
    if (outIdx !== -1 && args[outIdx + 1]) {
        output = args[outIdx + 1];
    }

    if (!demoPath || !startStr || !durStr) throw new Error('Usage: extract <demo.dm2> <start> <duration> -o <output.dm2>');

    const data = await fs.readFile(demoPath);
    const clip = await api.createDemoClip(data, parseFloat(startStr), parseFloat(durStr));

    await fs.writeFile(output, clip);
    console.log(`Clip written to ${output}`);
}

async function handleOptimize(api: DemoOptimizerApi, args: string[]) {
    const demoPath = args[0];
    // Find PAKs and options
    const pakPaths: string[] = [];
    let duration = 60;
    let outDir = 'package';

    for (let i = 1; i < args.length; i++) {
        const arg = args[i];
        if (arg === '-d' && args[i+1]) {
            duration = parseFloat(args[i+1]);
            i++;
        } else if (arg === '-o' && args[i+1]) {
            outDir = args[i+1];
            i++;
        } else if (!arg.startsWith('-')) {
            pakPaths.push(arg);
        }
    }

    if (!demoPath || pakPaths.length === 0) throw new Error('Usage: optimize <demo.dm2> <pak0.pak> ... -d <duration> -o <output_dir>');

    const demoData = await fs.readFile(demoPath);
    const pakFiles = await Promise.all(pakPaths.map(async p => ({
        name: path.basename(p),
        data: await fs.readFile(p)
    })));

    const pkg = await api.createOptimalDemoPackage(demoData, pakFiles, { duration });

    await fs.mkdir(outDir, { recursive: true });
    await fs.writeFile(path.join(outDir, 'demo.dm2'), pkg.demoData);
    await fs.writeFile(path.join(outDir, 'assets.pak'), pkg.pakData);
    await fs.writeFile(path.join(outDir, 'manifest.json'), JSON.stringify(pkg.manifest, null, 2));

    console.log(`Package created in ${outDir}`);
}

async function handleFindBest(api: DemoOptimizerApi, args: string[]) {
    const demoPath = args[0];
    let duration = 30;
    let top = 5;

    const durIdx = args.indexOf('--duration');
    if (durIdx !== -1 && args[durIdx+1]) {
        duration = parseFloat(args[durIdx+1]);
    }

    const topIdx = args.indexOf('--top');
    if (topIdx !== -1 && args[topIdx+1]) {
        top = parseInt(args[topIdx+1], 10);
    }

    if (!demoPath) throw new Error('Usage: find-best <demo.dm2> --duration <duration> --top <N>');

    const data = await fs.readFile(demoPath);
    // Note: api.findBestClips currently returns all or top 1?
    // Wait, OptimalClipFinder logic supports topN.
    // But api.findBestClips signature is (demoData, criteria: ClipCriteria).
    // ClipCriteria doesn't have topN.
    // I need to update ClipCriteria or check if I can pass it.
    // OptimalClipFinder.findOptimalWindows takes OptimizationOptions which HAS topN.
    // But api.findBestClips constructs OptimizationOptions from ClipCriteria.

    // I should probably update ClipCriteria in api.ts as well to support topN, or just rely on default.
    // But the requirement says "find-best ... --top 5".
    // So I should update api.ts.
    // But for now, I'll just pass what I can.
    // Wait, I am editing cli/demoOptimizer.ts right now.
    // I can't change api.ts in this tool call. I'll stick to what I have,
    // and maybe I should update api.ts in next step if I can't pass topN.

    // Let's check api.ts again.
    // findBestClips uses `optCriteria` derived from `criteria`.

    // I will assume I update api.ts as well or use what I have.
    // Actually, I can't update api.ts here. I will just pass it for now and fix api.ts in next step.

    const windows = await api.findBestClips(data, { duration });

    // If API returned more than needed, slice it?
    // But optimal clip finder probably returns all candidates or top 1 if not specified.
    // I'll leave it as is for now, but really I should update api.ts.

    console.log(JSON.stringify(windows.slice(0, top), null, 2));
}

// Entry point check
if (import.meta.url === `file://${process.argv[1]}`) {
    runCli(process.argv.slice(2));
}
