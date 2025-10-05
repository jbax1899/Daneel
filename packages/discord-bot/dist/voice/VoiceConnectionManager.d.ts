import { VoiceConnection } from '@discordjs/voice';
import { Client } from 'discord.js';
export declare class VoiceConnectionManager {
    constructor();
    /**
     * Cleans up any existing voice connections that might be lingering from a previous session
     */
    cleanupExistingConnections(client: Client): Promise<void>;
    /**
     * Cleans up a specific voice connection
     */
    cleanupVoiceConnection(connection: VoiceConnection | null, client: Client): Promise<void>;
}
/**
 * Cleans up a specific voice connection (standalone function for backward compatibility)
 */
export declare function cleanupVoiceConnection(connection: VoiceConnection | null, client: Client): Promise<void>;
