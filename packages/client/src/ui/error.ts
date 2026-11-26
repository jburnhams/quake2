import { Renderer } from '@quake2ts/engine';

export interface ErrorDialogState {
    active: boolean;
    title: string;
    message: string;
}

export class ErrorDialog {
    private state: ErrorDialogState = {
        active: false,
        title: '',
        message: ''
    };

    show(title: string, message: string) {
        this.state = {
            active: true,
            title,
            message
        };
    }

    hide() {
        this.state.active = false;
    }

    render(renderer: Renderer) {
        if (!this.state.active) return;

        const width = renderer.width;
        const height = renderer.height;
        const centerX = width / 2;
        const centerY = height / 2;
        const boxWidth = 400;
        const boxHeight = 200;

        // Overlay
        renderer.drawfillRect(0, 0, width, height, [0, 0, 0, 0.5]);

        // Dialog Box
        renderer.drawfillRect(centerX - boxWidth / 2, centerY - boxHeight / 2, boxWidth, boxHeight, [0.2, 0, 0, 1]); // Dark red for error

        // Text
        renderer.drawCenterString(centerY - 40, `^1${this.state.title}`); // ^1 for Red
        renderer.drawCenterString(centerY, this.state.message);
        renderer.drawCenterString(centerY + 60, "Press ESC to close");
    }
}
