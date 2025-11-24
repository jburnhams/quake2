export interface PakFile {
    name: string;
    size: number;
    data: ArrayBuffer;
}

export class PakLoaderUI {
    private loadedPaks: PakFile[] = [];

    constructor(private onLoad: (paks: PakFile[]) => Promise<void>) {}

    // This method would be called by the HTML file input change event handler
    async handleFileSelect(files: FileList) {
        const newPaks: PakFile[] = [];

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            // Basic validation - check extension?
            // Quake 2 PAKs are .pak, but we might support .zip or folders later.
            if (file.name.toLowerCase().endsWith('.pak')) {
                try {
                    const buffer = await file.arrayBuffer();
                    newPaks.push({
                        name: file.name,
                        size: file.size,
                        data: buffer
                    });
                } catch (e) {
                    console.error(`Failed to read file ${file.name}`, e);
                }
            }
        }

        if (newPaks.length > 0) {
            this.loadedPaks.push(...newPaks);
            await this.onLoad(newPaks);
        }

        return newPaks.length;
    }

    getLoadedPaks(): ReadonlyArray<PakFile> {
        return this.loadedPaks;
    }
}
