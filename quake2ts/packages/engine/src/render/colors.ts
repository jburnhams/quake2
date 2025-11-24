// Color code mapping for Quake 2
// ^1 = Red
// ^2 = Green
// ^3 = Yellow
// ^4 = Blue
// ^5 = Cyan
// ^6 = Magenta
// ^7 = White (Default)
// ^0 = Black (Usually treated as default or ignored in some engines)

export const QUAKE2_COLORS: Record<string, [number, number, number, number]> = {
    '1': [1, 0, 0, 1],       // Red
    '2': [0, 1, 0, 1],       // Green
    '3': [1, 1, 0, 1],       // Yellow
    '4': [0, 0, 1, 1],       // Blue
    '5': [0, 1, 1, 1],       // Cyan
    '6': [1, 0, 1, 1],       // Magenta
    '7': [1, 1, 1, 1],       // White
    '0': [0, 0, 0, 1],       // Black (or default?)
};

export function parseColorString(text: string): { text: string, color?: [number, number, number, number] }[] {
    const segments: { text: string, color?: [number, number, number, number] }[] = [];
    let currentText = '';
    let currentColor: [number, number, number, number] | undefined = undefined;

    for (let i = 0; i < text.length; i++) {
        if (text[i] === '^' && i + 1 < text.length) {
            const code = text[i + 1];
            if (QUAKE2_COLORS[code]) {
                if (currentText.length > 0) {
                    segments.push({ text: currentText, color: currentColor });
                    currentText = '';
                }
                currentColor = QUAKE2_COLORS[code];
                i++; // Skip the code
                continue;
            } else if (code === '^') {
                // Escaped caret? Quake 2 usually doesn't escape, but let's treat ^^ as ^
                // Actually, standard Q2 doesn't escape. ^ followed by unknown char is just printed.
                // But standard practice in some ports.
            }
        }
        currentText += text[i];
    }

    if (currentText.length > 0) {
        segments.push({ text: currentText, color: currentColor });
    }

    return segments;
}
