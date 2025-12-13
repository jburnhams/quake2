export interface ParsedPickup {
    itemName: string;
}

export interface ParsedObituary {
    victim: string;
    killer?: string;
    method: string;
}

export function parsePickupMessage(msg: string): ParsedPickup | null {
    if (msg.startsWith('You got the ')) {
        const itemName = msg.substring(12);
        return { itemName };
    }
    return null;
}

export function parseObituaryMessage(msg: string): ParsedObituary | null {
    // "Player1 died."
    if (msg.endsWith(' died.')) {
        const victim = msg.substring(0, msg.length - 6);
        return { victim, method: 'died.' };
    }

    // "Player1 was railed by Player2"
    const byIndex = msg.lastIndexOf(' by ');
    if (byIndex !== -1) {
        // Look for " was "
        const wasIndex = msg.indexOf(' was ');
        if (wasIndex !== -1) {
            const victim = msg.substring(0, wasIndex);
            const method = msg.substring(wasIndex + 1, byIndex + 3); // "was railed by"
            const killer = msg.substring(byIndex + 4);
            return { victim, killer, method };
        }
    }

    return null;
}
