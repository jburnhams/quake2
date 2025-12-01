    private SV_ReadPackets() {
        for (const client of this.svs.clients) {
            if (!client || client.state === ClientState.Free) continue;

            while (client.messageQueue.length > 0) {
                const data = client.messageQueue.shift();
                if (!data) continue;

                // Log packet size for debug
                console.log(`SV_ReadPackets: Processing ${data.byteLength} bytes from client ${client.index}`);

                const reader = new BinaryStream(data.buffer);

                // Read sequence numbers (standard Q2 NetChan header)
                // The client sends: sequence (4), sequence_ack (4)
                // If we are using raw WebSockets without Q2 header, we might skip this.
                // BUT MultiplayerConnection handles incoming with `stream.readLong()` x2.
                // However, MultiplayerConnection SENDING might NOT include it?
                // Let's check NetworkMessageBuilder or usage in MultiplayerConnection.

                // In MultiplayerConnection.sendChallenge:
                // const builder = new NetworkMessageBuilder();
                // builder.writeByte(ClientCommand.stringcmd);
                // ...
                // It does NOT write NetChan header (sequence numbers).

                // So the server receives raw commands.
                // BUT `ClientMessageParser` usually expects just commands?
                // Or does it expect NetChan header?

                // Let's check ClientMessageParser implementation in shared/protocol or server/protocol.
                // It seems to be imported from './protocol.js'.

                // Assuming it just parses commands.

                const parser = new ClientMessageParser(reader, {
                    onMove: (checksum, lastFrame, cmd) => this.handleMove(client, cmd),
                    onUserInfo: (info) => this.handleUserInfo(client, info),
                    onStringCmd: (cmd) => {
                        console.log(`SV_ReadPackets: Received stringcmd: ${cmd}`);
                        this.handleStringCmd(client, cmd);
                    },
                    onNop: () => {},
                    onBad: () => {
                        console.warn(`Bad command from client ${client.index}`);
                    }
                });

                try {
                    parser.parseMessage();
                } catch (e) {
                    console.error(`Error parsing message from client ${client.index}:`, e);
                }
            }
        }
    }
