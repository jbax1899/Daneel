import test from 'node:test';
import assert from 'node:assert/strict';
import { RealtimeAudioHandler } from '../src/realtime/RealtimeAudioHandler.js';
import { AUDIO_CONSTANTS } from '../src/constants/voice.js';
import { VoiceSessionManager } from '../src/voice/VoiceSessionManager.js';
import { AudioCaptureHandler } from '../src/voice/AudioCaptureHandler.js';
import { RealtimeEventHandler } from '../src/realtime/RealtimeEventHandler.js';

class MockWebSocket {
    public sent: any[] = [];
    public readyState = 1;

    send(payload: string) {
        this.sent.push(JSON.parse(payload));
    }
}

class MockEventHandler extends RealtimeEventHandler {
    public collected = 0;

    constructor() {
        super();
    }

    async waitForAudioCollected(): Promise<void> {
        this.collected += 1;
    }
}

class FakeRealtimeSession {
    public readonly chunks: { speaker: string; buffer: Buffer; userId?: string }[] = [];
    public flushes = 0;

    async sendAudio(buffer: Buffer, speaker: string, userId?: string): Promise<void> {
        this.chunks.push({ speaker, buffer: Buffer.from(buffer), userId });
    }

    async flushAudio(): Promise<void> {
        this.flushes += 1;
    }

    clearAudio(): void {}
    disconnect(): void {}
}

const noopPlaybackHandler = {} as any;
const noopConnection = {} as any;

const waitForPipeline = async (session: any) => {
    await session.audioPipeline;
    await new Promise(resolve => setImmediate(resolve));
};

test('RealtimeAudioHandler annotates speaker label before commit', async () => {
    const handler = new RealtimeAudioHandler();
    const ws = new MockWebSocket();
    const eventHandler = new MockEventHandler();
    const chunk = Buffer.from([0, 1, 2, 3]);

    await handler.sendAudio(ws as any, eventHandler, chunk, 'Alice', 'user-1');
    await handler.flushAudio(ws as any, eventHandler);

    assert.equal(ws.sent.length, 4);
    assert.equal(ws.sent[0].type, 'input_audio_buffer.append');
    assert.equal(ws.sent[1].type, 'input_audio_buffer.append');
    assert.equal(ws.sent[2].type, 'conversation.item.create');
    assert.equal(ws.sent[2].item.content[0].type, 'input_text');
    assert.match(ws.sent[2].item.content[0].text, /Alice/);
    assert.equal(ws.sent[2].item.content[1].type, 'input_audio');
    assert.equal(ws.sent[2].item.content[1].audio.format.type, 'audio/pcm');
    assert.equal(ws.sent[2].item.content[1].audio.format.rate, AUDIO_CONSTANTS.REALTIME_SAMPLE_RATE);
    assert.equal(ws.sent[2].item.content[1].audio.format.channels, AUDIO_CONSTANTS.CHANNELS);
    assert.equal(ws.sent[3].type, 'input_audio_buffer.commit');
    assert.equal(eventHandler.collected, 1);
});

test('VoiceSessionManager forwards multi-speaker audio with display names', async () => {
    const manager = new VoiceSessionManager();
    const audioCapture = new AudioCaptureHandler();
    const realtimeSession = new FakeRealtimeSession();
    const participants = new Map([
        ['user-1', 'Alice'],
        ['user-2', 'Bob'],
    ]);

    const session = manager.createSession(
        noopConnection,
        realtimeSession as any,
        audioCapture,
        noopPlaybackHandler,
        participants,
    );

    manager.addSession('guild-1', session);

    audioCapture.emit('audioChunk', { guildId: 'guild-1', userId: 'user-1', audioBuffer: Buffer.from([1, 2]) });
    audioCapture.emit('audioChunk', { guildId: 'guild-1', userId: 'user-2', audioBuffer: Buffer.from([3, 4]) });
    audioCapture.emit('speakerSilence', { guildId: 'guild-1', userId: 'user-1' });

    await waitForPipeline(session);

    assert.deepEqual(
        realtimeSession.chunks.map(({ speaker }) => speaker),
        ['Alice', 'Bob'],
    );
    assert.deepEqual(Array.from(realtimeSession.chunks[0].buffer.values()), [1, 2]);
    assert.deepEqual(Array.from(realtimeSession.chunks[1].buffer.values()), [3, 4]);
    assert.equal(realtimeSession.flushes, 1);

    manager.removeSession('guild-1');
});
