export class DebugOverlay {
    private readonly element: HTMLElement;

    constructor() {
        this.element = document.createElement('div');
        this.element.style.position = 'absolute';
        this.element.style.top = '10px';
        this.element.style.left = '10px';
        this.element.style.color = 'white';
        this.element.style.fontFamily = 'monospace';
        this.element.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
        this.element.style.padding = '10px';
        document.body.appendChild(this.element);
    }

    update(data: Record<string, any>) {
        let html = '';
        for (const key in data) {
            html += `<strong>${key}:</strong> ${JSON.stringify(data[key])}<br>`;
        }
        this.element.innerHTML = html;
    }
}
