export declare const AUDIO_CONSTANTS: {
    readonly MIN_AUDIO_BUFFER_SIZE: 4800;
    readonly DISCORD_SAMPLE_RATE: 48000;
    readonly DISCORD_FRAME_SIZE: 960;
    readonly REALTIME_SAMPLE_RATE: 24000;
    readonly REALTIME_FRAME_SIZE: 480;
    readonly CHANNELS: 1;
};
export declare const TIMEOUT_CONSTANTS: {
    readonly MAX_RESPONSE_WAIT_TIME: 30000;
    readonly RESPONSE_POLLING_INTERVAL: 50;
    readonly SESSION_CONFIG_DELAY: 500;
    readonly AUDIO_COMMIT_DELAY: 500;
    readonly SILENCE_DURATION: 300;
};
export declare const RECONNECTION_CONSTANTS: {
    readonly MAX_RECONNECT_ATTEMPTS: 3;
    readonly INITIAL_RECONNECT_DELAY: 1000;
    readonly MAX_RECONNECT_DELAY: 30000;
    readonly RECONNECT_BACKOFF_MULTIPLIER: 2;
};
