// A recorded frame's player state carries only what changed since the frame it deltas from
// (SV_WritePlayerstateToClient), so the playback controller rebuilds it as CL_ParsePlayerstate
// does before it hands a frame out.
import { describe, it, expect } from 'vitest';
import { DemoPlaybackController } from '../../../src/demo/playback.js';
import { DemoRecorder } from '../../../src/demo/recorder.js';
import { MessageWriter } from '../../../src/demo/writer.js';
import { createEmptyProtocolPlayerState, type FrameData, type ProtocolPlayerState } from '../../../src/demo/state.js';

const frame = (serverFrame: number, deltaFrame: number, playerState: ProtocolPlayerState): FrameData => ({
  serverFrame, deltaFrame, surpressCount: 0, areaBytes: 0, areaBits: new Uint8Array(0), playerState,
  packetEntities: { delta: deltaFrame > 0, entities: [] },
});

describe('demo playback player state', () => {
  it('keeps the fields a frame did not send', () => {
    const first = createEmptyProtocolPlayerState();
    first.stats[1] = 100;
    first.fov = 90;
    const second = createEmptyProtocolPlayerState();
    second.stats[1] = 100;
    second.fov = 110;

    const recorder = new DemoRecorder();
    recorder.startRecording('t.dm2');
    const serverData = new MessageWriter();
    serverData.writeServerData(34, 1, 1, 'baseq2', 0, 'q2dm1');
    recorder.recordMessage(serverData.getData());
    const one = new MessageWriter();
    one.writeFrame(frame(1, -1, first), 34);
    recorder.recordMessage(one.getData());
    const two = new MessageWriter();
    two.writeFrame(frame(2, 1, second), 34, first); // sends the fov only
    recorder.recordMessage(two.getData());
    const data = recorder.stopRecording()!;

    const playback = new DemoPlaybackController();
    const seen: FrameData[] = [];
    playback.setCallbacks({ onFrameUpdate: (f) => seen.push(f) });
    playback.loadDemo(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer);
    playback.seek(2);

    expect(seen.map((f) => f.serverFrame)).toEqual([1, 2]);
    expect(seen[1].playerState.fov).toBe(110);
    expect(seen[1].playerState.stats[1]).toBe(100); // not sent, kept from frame 1
    expect(playback.getFramePlayerState(2)?.stats[1]).toBe(100);
  });
});
