    // Helper to create a minimal demo with config strings and frames
    const createTestDemo = (): Uint8Array => {
        const writer = new DemoWriter();
        const proto = 34;
        const msgWriter = new MessageWriter();

        // 1. ServerData
        msgWriter.writeServerData(proto, 1, 0, 'baseq2', 0, 'q2dm1');

        // 2. ConfigStrings (Models and Sounds)
        msgWriter.writeConfigString(ConfigStringIndex.Models + 0, 'players/male/tris.md2');
        msgWriter.writeConfigString(ConfigStringIndex.Sounds + 0, 'weapons/railgf1a.wav');

        writer.writeBlock(msgWriter.getData());

        // 3. Frame 1: Entity using Model 1
        const frameWriter = new MessageWriter();
        const frame1: FrameData = {
            serverFrame: 1,
            deltaFrame: -1,
            surpressCount: 0,
            areaBytes: 0,
            areaBits: new Uint8Array(0),
            playerState: createEmptyProtocolPlayerState(),
            packetEntities: {
                delta: false,
                entities: [
                    {
                        number: 1,
                        modelIndex: 1,
                        modelIndex2: 0,
                        modelIndex3: 0,
                        modelIndex4: 0,
                        frame: 0,
                        skinNum: 0,
                        effects: 0,
                        renderfx: 0,
                        origin: {x: 100, y: 100, z: 0},
                        angles: {x: 0, y: 0, z: 0},
                        oldOrigin: {x: 100, y: 100, z: 0},
                        sound: 0,
                        event: 0,
                        solid: 0
                        // bits and bitsHigh are not part of EntityState anymore
                    } as any
                ]
            }
        };
        frameWriter.writeFrame(frame1, proto);
        writer.writeBlock(frameWriter.getData());

        // 4. Frame 2: Sound event
        const frameWriter2 = new MessageWriter();
        frameWriter2.writeSound(
            0, 1, 1, 1, 0, 1, {x: 100, y: 100, z: 0}, proto
        );

        const frame2: FrameData = {
            serverFrame: 2,
            deltaFrame: 1,
            surpressCount: 0,
            areaBytes: 0,
            areaBits: new Uint8Array(0),
            playerState: createEmptyProtocolPlayerState(),
            packetEntities: { delta: false, entities: [] }
        };
        frameWriter2.writeFrame(frame2, proto);
        writer.writeBlock(frameWriter2.getData());

        writer.writeEOF();
        return writer.getData();
    };
