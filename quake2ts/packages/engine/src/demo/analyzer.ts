import { DemoReader } from './demoReader.js';
import { NetworkMessageParser, NetworkMessageHandler, FrameData, EntityState, ProtocolPlayerState, DamageIndicator } from './parser.js';
import { DemoEvent, DemoEventType, EventSummary, DemoHeader, ServerInfo, DemoStatistics, PlayerStatistics, WeaponStatistics } from './analysis.js';
import { Vec3, ServerCommand } from '@quake2ts/shared';

/**
 * Helper class to scan a demo for events and metadata.
 */
export class DemoAnalyzer {
    private buffer: ArrayBuffer;
    private events: DemoEvent[] = [];
    private summary: EventSummary = {
        totalKills: 0,
        totalDeaths: 0,
        damageDealt: 0,
        damageReceived: 0,
        weaponUsage: new Map()
    };

    private header: DemoHeader | null = null;
    private configStrings: Map<number, string> = new Map();
    private serverInfo: ServerInfo = {};
    private statistics: DemoStatistics | null = null;
    private playerStats: Map<number, PlayerStatistics> = new Map(); // By playerNum
    private weaponStats: Map<number, WeaponStatistics[]> = new Map();

    constructor(buffer: ArrayBuffer) {
        this.buffer = buffer;
    }

    public analyze(): {
        events: DemoEvent[],
        summary: EventSummary,
        header: DemoHeader | null,
        configStrings: Map<number, string>,
        serverInfo: ServerInfo,
        statistics: DemoStatistics | null
    } {
        const reader = new DemoReader(this.buffer);
        let currentFrameIndex = -1;
        let currentTime = 0;
        let frameDuration = 0.1;

        let protocolVersion = 0;

        const handler: NetworkMessageHandler = {
            onServerData: (protocol, serverCount, attractLoop, gameDir, playerNum, levelName, tickRate, demoType) => {
                 protocolVersion = protocol;
                 this.header = {
                     protocolVersion: protocol,
                     gameDir,
                     levelName,
                     playerNum,
                     serverCount,
                     spawnCount: serverCount, // Mapping generic arg
                     tickRate,
                     demoType
                 };
                 if (tickRate && tickRate > 0) {
                     frameDuration = 1.0 / tickRate;
                 }
            },
            onConfigString: (index, str) => {
                this.configStrings.set(index, str);
                // If index is CS_SERVERINFO (0), parse it
                if (index === 0) {
                    this.parseServerInfo(str);
                }
            },
            onSpawnBaseline: (entity) => {},
            onFrame: (frame: FrameData) => {
                // Could update stats based on player state
            },
            onPrint: (level, msg) => {
                 // Check for death messages
                 // Simple heuristic for now
                 if (msg.includes("died") || msg.includes("killed")) {
                     this.summary.totalDeaths++;
                     this.recordEvent({
                        type: DemoEventType.Death,
                        frame: currentFrameIndex,
                        time: currentTime,
                        description: msg.trim()
                     });
                 }
            },
            onCenterPrint: () => {},
            onStuffText: () => {},
            onSound: () => {},
            onTempEntity: () => {},
            onLayout: () => {},
            onInventory: () => {},
            onMuzzleFlash: (ent, weapon) => {
                this.handleWeaponFire(ent, weapon, currentFrameIndex, currentTime);
            },
            onMuzzleFlash2: (ent, weapon) => {
                 this.handleWeaponFire(ent, weapon, currentFrameIndex, currentTime);
            },
            onMuzzleFlash3: (ent, weapon) => {
                 this.handleWeaponFire(ent, weapon, currentFrameIndex, currentTime);
            },
            onDisconnect: () => {},
            onReconnect: () => {},
            onDownload: () => {},

            // Rerelease specific
            onDamage: (indicators: DamageIndicator[]) => {
                for (const ind of indicators) {
                     this.recordEvent({
                        type: DemoEventType.DamageReceived,
                        frame: currentFrameIndex,
                        time: currentTime,
                        value: ind.damage,
                        position: ind.dir,
                        description: `Took ${ind.damage} damage`
                    });
                    this.summary.damageReceived += ind.damage;
                }
            }
        };

        // We need to loop through frames
        while (reader.hasMore()) {
            const block = reader.readNextBlock();
            if (!block) break;

            currentFrameIndex++;
            currentTime = currentFrameIndex * frameDuration;

            const parser = new NetworkMessageParser(block.data, handler);
            parser.setProtocolVersion(protocolVersion);
            parser.parseMessage();
            protocolVersion = parser.getProtocolVersion();
        }

        // Finalize stats
        this.statistics = {
            duration: currentTime,
            frameCount: currentFrameIndex + 1,
            averageFps: (currentFrameIndex + 1) / (currentTime || 1),
            mapName: this.header?.levelName || "unknown",
            playerCount: 1 // Default to 1 for SP/client demo
        };

        return {
            events: this.events,
            summary: this.summary,
            header: this.header,
            configStrings: this.configStrings,
            serverInfo: this.serverInfo,
            statistics: this.statistics
        };
    }

    private handleWeaponFire(ent: number, weapon: number, frame: number, time: number) {
        this.recordEvent({
            type: DemoEventType.WeaponFire,
            frame: frame,
            time: time,
            entityId: ent,
            value: weapon,
            description: `Weapon ${weapon} fired by ${ent}`
        });

        const count = this.summary.weaponUsage.get(weapon) || 0;
        this.summary.weaponUsage.set(weapon, count + 1);
    }

    private recordEvent(event: DemoEvent) {
        this.events.push(event);
    }

    private parseServerInfo(str: string) {
        const parts = str.split('\\');
        // Q2 config strings start with backslash usually?
        // Example: \mapname\base1\gamemode\deathmatch
        for (let i = 1; i < parts.length; i += 2) {
            if (i + 1 < parts.length) {
                this.serverInfo[parts[i]] = parts[i+1];
            }
        }
    }
}
