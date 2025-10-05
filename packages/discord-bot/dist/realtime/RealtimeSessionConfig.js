import { logger } from '../utils/logger.js';
export class RealtimeSessionConfig {
    options;
    constructor(options = {}) {
        this.options = {
            model: 'gpt-realtime',
            voice: 'echo',
            ...options
        };
    }
    getOptions() {
        return { ...this.options };
    }
    updateOptions(newOptions) {
        this.options = { ...this.options, ...newOptions };
    }
    getModel() {
        return this.options.model || 'gpt-realtime';
    }
    getVoice() {
        return this.options.voice || 'echo';
    }
    getInstructions() {
        return this.options.instructions;
    }
    sendSessionConfig(ws) {
        if (!ws)
            return;
        const sessionUpdate = {
            type: 'session.update',
            session: {
                type: 'realtime',
                model: this.options.model,
                instructions: this.options.instructions,
                output_modalities: ['audio'],
                audio: {
                    input: {
                        format: {
                            type: 'audio/pcm',
                            rate: 24000, // OpenAI outputs 24kHz PCM
                            //channels: 1,    // Mono
                            //sample_size: 16 // 16-bit PCM
                        },
                        turn_detection: null
                    },
                    output: {
                        format: {
                            type: 'audio/pcm',
                            rate: 24000, // Match OpenAI's 24kHz output
                            //channels: 1,    // Mono
                            //sample_size: 16 // 16-bit PCM
                        },
                        voice: this.options.voice,
                    }
                }
            }
        };
        try {
            ws.send(JSON.stringify(sessionUpdate));
            logger.debug('Sent session configuration with 24kHz PCM16 audio settings');
        }
        catch (error) {
            logger.error('Failed to send session configuration:', error);
            throw error;
        }
    }
    createResponse(ws) {
        if (!ws)
            return;
        logger.debug('Creating response');
        const event = {
            type: 'response.create',
            response: {
                output_modalities: ['audio'],
                instructions: this.options.instructions
            }
        };
        if (this.options.instructions) {
            event.response.instructions = this.options.instructions;
        }
        logger.debug('Sending response.create event');
        ws.send(JSON.stringify(event));
    }
    enableVAD(ws) {
        if (!ws)
            return;
        const vadUpdate = {
            type: 'session.update',
            session: {
                type: 'realtime',
                audio: {
                    input: {
                        turn_detection: {
                            type: 'semantic_vad'
                        }
                    }
                }
            }
        };
        ws.send(JSON.stringify(vadUpdate));
        logger.debug('Enabled VAD for session');
    }
}
//# sourceMappingURL=RealtimeSessionConfig.js.map