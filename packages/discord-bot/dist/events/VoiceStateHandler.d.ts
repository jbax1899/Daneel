import { Client, VoiceState } from 'discord.js';
import { Event } from './Event.js';
import { VoiceConnection } from '@discordjs/voice';
export declare class VoiceStateHandler extends Event {
    private sessionManager;
    private audioCaptureHandler;
    private audioPlaybackHandler;
    private userVoiceStateHandler;
    private connectionManager;
    private client;
    private realtimeContextBuilder;
    constructor(client: Client);
    execute(oldState: VoiceState, newState: VoiceState): Promise<void>;
    private handleBotVoiceStateChange;
    private handleBotJoinedChannel;
    private collectVoiceParticipants;
    registerInitiatingUser(guildId: string, userId: string): void;
    createSession(guildId: string, channelId: string): Promise<void>;
    private handleBotLeftChannel;
    private startConversation;
    private createRealtimeSession;
    private removeRealtimeSessionListeners;
    cleanupExistingConnections(): Promise<void>;
}
export declare function cleanupVoiceConnection(connection: VoiceConnection | null, client: Client): Promise<void>;
export default VoiceStateHandler;
