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
    private weaponStats: Map<number, WeaponStatistics[]> = new Map(); // By entity ID

    private activeEntities = new Set<number>();

    constructor(buffer: ArrayBuffer) {
        this.buffer = buffer;
    }

    public analyze(): {
        events: DemoEvent[],
        summary: EventSummary,
        header: DemoHeader | null,
        configStrings: Map<number, string>,
        serverInfo: ServerInfo,
        statistics: DemoStatistics | null,
        playerStats: Map<number, PlayerStatistics>,
        weaponStats: Map<number, WeaponStatistics[]>
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
                // Detect Spawns
                const currentFrameEntities = new Set<number>();
                if (frame.packetEntities && frame.packetEntities.entities) {
                    for (const ent of frame.packetEntities.entities) {
                        currentFrameEntities.add(ent.number);
                        if (!this.activeEntities.has(ent.number)) {
                             this.recordEvent({
                                type: DemoEventType.Spawn,
                                frame: currentFrameIndex,
                                time: currentTime,
                                entityId: ent.number,
                                position: { x: ent.origin.x, y: ent.origin.y, z: ent.origin.z },
                                description: `Entity ${ent.number} spawned`
                            });
                        }
                    }
                }
                this.activeEntities = currentFrameEntities;

                // Update Player Stats from PlayerState if available
                // Assuming single player demo for now, playerNum is from ServerData
                if (frame.playerState && this.header) {
                     // We can track damage dealt if stats[12] (damage_dealt) changes?
                     // stats array indices depend on game, but generic engine doesn't know layout.
                }
            },
            onPrint: (level, msg) => {
                 const text = msg.replace(/\n/g, ' ').trim();
                 // Check for death messages
                 if (text.includes("died") || text.includes("killed") || text.includes("suicide")) {
                     this.summary.totalDeaths++; // Simple count
                     this.recordEvent({
                        type: DemoEventType.Death,
                        frame: currentFrameIndex,
                        time: currentTime,
                        description: text
                     });

                     // Detect kill vs death
                     // "Player was killed by Monster" -> Death
                     // "Monster was killed by Player" -> Kill (if we are Player)
                     // Since we don't have full name mapping easily, we assume "Death" for now unless we match our name.
                 } else if (text.startsWith("You got the ")) {
                     this.recordEvent({
                         type: DemoEventType.Pickup,
                         frame: currentFrameIndex,
                         time: currentTime,
                         description: text
                     });
                 } else {
                     // Chat or other messages
                     // PRINT_CHAT is usually level 3, but onPrint arg 'level' tells us.
                     if (level === 3 || level === 2) { // Chat or Medium
                         this.recordEvent({
                             type: DemoEventType.Chat,
                             frame: currentFrameIndex,
                             time: currentTime,
                             description: text,
                             data: { level }
                         });
                     }
                 }
            },
            onCenterPrint: (msg) => {
                this.recordEvent({
                    type: DemoEventType.Objective,
                    frame: currentFrameIndex,
                    time: currentTime,
                    description: msg.trim()
                });
            },
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

                    // Update player stats for the recording player
                    if (this.header) {
                        const pStats = this.getOrCreatePlayerStats(this.header.playerNum);
                        pStats.damageReceived += ind.damage;
                    }
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
            statistics: this.statistics,
            playerStats: this.playerStats,
            weaponStats: this.weaponStats
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

        const wStats = this.getOrCreateWeaponStat(ent, weapon);
        wStats.shotsFired++;
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

    private getOrCreatePlayerStats(playerNum: number): PlayerStatistics {
        let stats = this.playerStats.get(playerNum);
        if (!stats) {
            stats = {
                kills: 0,
                deaths: 0,
                damageDealt: 0,
                damageReceived: 0,
                suicides: 0
            };
            this.playerStats.set(playerNum, stats);
        }
        return stats;
    }

    private getOrCreateWeaponStat(entityId: number, weaponId: number): WeaponStatistics {
        let statsList = this.weaponStats.get(entityId);
        if (!statsList) {
            statsList = [];
            this.weaponStats.set(entityId, statsList);
        }
        let stat = statsList.find(s => s.weaponId === weaponId);
        if (!stat) {
            stat = { weaponId, shotsFired: 0, hits: 0, kills: 0 };
            statsList.push(stat);
        }
        return stat;
    }
}
