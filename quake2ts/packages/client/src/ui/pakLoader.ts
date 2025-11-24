export interface PakFile {
    name: string;
    size: number;
    data: ArrayBuffer;
}

export class PakLoaderUI {
    private loadedPaks: PakFile[] = [];
<<<<<<< HEAD
<<<<<<< HEAD

    constructor(private onLoad: (paks: PakFile[]) => Promise<void>) {}

    // This method would be called by the HTML file input change event handler
=======
=======
>>>>>>> origin/main
    private container: HTMLElement | null = null;
    private fileInput: HTMLInputElement | null = null;
    private dropZone: HTMLElement | null = null;
    private pakList: HTMLElement | null = null;
    private startButton: HTMLButtonElement | null = null;

    constructor(private onLoad: (paks: PakFile[]) => Promise<void>) {}

    mount(container: HTMLElement) {
        this.container = container;
        this.render();
        this.bindEvents();
    }

    unmount() {
        if (this.container) {
            this.container.innerHTML = '';
        }
        this.container = null;
        this.fileInput = null;
        this.dropZone = null;
        this.pakList = null;
        this.startButton = null;
    }

    private render() {
        if (!this.container) return;

        this.container.innerHTML = `
            <div style="
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                height: 100%;
                background-color: #222;
                color: #eee;
                font-family: monospace;
            ">
                <h1>Quake II TS</h1>
                <div id="drop-zone" style="
                    border: 2px dashed #666;
                    border-radius: 8px;
                    padding: 40px;
                    margin: 20px;
                    text-align: center;
                    cursor: pointer;
                    background-color: #333;
                ">
                    <p style="font-size: 1.2em; margin-bottom: 10px;">Drag & Drop PAK files here</p>
                    <p style="color: #aaa;">or click to browse</p>
                    <input type="file" id="pak-input" multiple accept=".pak" style="display: none;">
                </div>

                <div id="pak-list" style="
                    margin: 20px;
                    width: 300px;
                    text-align: left;
                "></div>

                <button id="start-button" disabled style="
                    padding: 10px 20px;
                    font-size: 1.2em;
                    cursor: pointer;
                    background-color: #555;
                    color: #888;
                    border: none;
                    border-radius: 4px;
                ">Start Game</button>
            </div>
        `;

        this.dropZone = this.container.querySelector('#drop-zone');
        this.fileInput = this.container.querySelector('#pak-input');
        this.pakList = this.container.querySelector('#pak-list');
        this.startButton = this.container.querySelector('#start-button') as HTMLButtonElement;
    }

    private bindEvents() {
        if (!this.dropZone || !this.fileInput || !this.startButton) return;

        this.dropZone.addEventListener('click', () => this.fileInput?.click());

        this.dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            this.dropZone!.style.borderColor = '#aaa';
            this.dropZone!.style.backgroundColor = '#444';
        });

        this.dropZone.addEventListener('dragleave', (e) => {
            e.preventDefault();
            this.dropZone!.style.borderColor = '#666';
            this.dropZone!.style.backgroundColor = '#333';
        });

        this.dropZone.addEventListener('drop', async (e) => {
            e.preventDefault();
            this.dropZone!.style.borderColor = '#666';
            this.dropZone!.style.backgroundColor = '#333';

            if (e.dataTransfer?.files) {
                await this.handleFileSelect(e.dataTransfer.files);
            }
        });

        this.fileInput.addEventListener('change', async (e) => {
            if (this.fileInput?.files) {
                await this.handleFileSelect(this.fileInput.files);
            }
            // Reset input so same file can be selected again if needed
            this.fileInput!.value = '';
        });

        this.startButton.addEventListener('click', async () => {
            if (this.loadedPaks.length > 0) {
                // Transition to game loading?
                // For now, assume onLoad has already handled data ingestion,
                // but maybe we want to trigger the actual "Start" here.
                // The current contract says onLoad is called when files are selected.
                // We might want to change that flow or just hide the UI.
                this.unmount();
            }
        });
    }

<<<<<<< HEAD
>>>>>>> 40ca6857d501c73b890d6872b901150001e7151e
=======
>>>>>>> origin/main
    async handleFileSelect(files: FileList) {
        const newPaks: PakFile[] = [];

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
<<<<<<< HEAD
<<<<<<< HEAD
            // Basic validation - check extension?
            // Quake 2 PAKs are .pak, but we might support .zip or folders later.
=======
>>>>>>> 40ca6857d501c73b890d6872b901150001e7151e
=======
>>>>>>> origin/main
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
<<<<<<< HEAD
<<<<<<< HEAD
            await this.onLoad(newPaks);
=======
=======
>>>>>>> origin/main
            this.updateList();
            await this.onLoad(newPaks);

            if (this.startButton) {
                this.startButton.disabled = false;
                this.startButton.style.backgroundColor = '#4a4';
                this.startButton.style.color = '#fff';
            }
<<<<<<< HEAD
>>>>>>> 40ca6857d501c73b890d6872b901150001e7151e
=======
>>>>>>> origin/main
        }

        return newPaks.length;
    }

<<<<<<< HEAD
<<<<<<< HEAD
=======
=======
>>>>>>> origin/main
    private updateList() {
        if (!this.pakList) return;

        this.pakList.innerHTML = this.loadedPaks
            .map(pak => `<div style="padding: 5px; border-bottom: 1px solid #444;">✓ ${pak.name} (${(pak.size / 1024 / 1024).toFixed(1)} MB)</div>`)
            .join('');
    }

<<<<<<< HEAD
>>>>>>> 40ca6857d501c73b890d6872b901150001e7151e
=======
>>>>>>> origin/main
    getLoadedPaks(): ReadonlyArray<PakFile> {
        return this.loadedPaks;
    }
}
