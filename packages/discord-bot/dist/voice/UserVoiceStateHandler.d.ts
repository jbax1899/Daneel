import { VoiceState } from 'discord.js';
import { VoiceSessionManager } from './VoiceSessionManager.js';
export declare class UserVoiceStateHandler {
    private initiatingUsers;
    private sessionManager;
    constructor(sessionManager: VoiceSessionManager);
    handleUserVoiceChange(oldState: VoiceState, newState: VoiceState, client: any, startConversationCallback: (guildId: string) => Promise<void>): Promise<void>;
    private handleUserJoinedBotChannel;
    private handleUserLeftBotChannel;
    registerInitiatingUser(guildId: string, userId: string): void;
    getInitiatingUser(guildId: string): string | undefined;
    clearInitiatingUser(guildId: string): void;
}
