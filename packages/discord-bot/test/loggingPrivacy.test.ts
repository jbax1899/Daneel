import test from 'node:test';
import assert from 'node:assert/strict';

import { OpenAIService, type OpenAIMessage } from '../src/utils/openaiService.js';
import { logger } from '../src/utils/logger.js';
import { logContextIfVerbose } from '../src/utils/prompting/ContextBuilder.js';

const createStubbedOpenAIService = () => {
    const service = new OpenAIService('test-key');
    // @ts-expect-error overriding private field for testing
    service.openai = {
        responses: {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            create: async (_payload: unknown) => ({
                output: [
                    {
                        type: 'message',
                        role: 'assistant',
                        content: [
                            {
                                type: 'output_text',
                                text: 'acknowledged'
                            }
                        ],
                        finish_reason: 'stop'
                    }
                ],
                usage: {
                    input_tokens: 10,
                    output_tokens: 5
                }
            })
        }
    };

    return service;
};

test('generateResponse logs sanitized metadata without raw message bodies', async () => {
    const service = createStubbedOpenAIService();
    const originalDebug = logger.debug;
    const debugCalls: unknown[][] = [];

    logger.debug = ((...args: unknown[]) => {
        debugCalls.push(args);
        return logger;
    }) as typeof logger.debug;

    const messages: OpenAIMessage[] = [
        { role: 'user', content: 'super secret discord message' }
    ];

    try {
        await service.generateResponse('gpt-5-mini', messages, {});
    } finally {
        logger.debug = originalDebug;
    }

    const payloadLog = debugCalls.find(([firstArg]) =>
        typeof firstArg === 'string' && firstArg.includes('Generating AI response')
    );

    assert.ok(payloadLog, 'Expected sanitized payload log entry to be emitted');

    const flattened = payloadLog
        ?.map(arg => typeof arg === 'string' ? arg : JSON.stringify(arg))
        .join(' ');

    assert.ok(
        flattened && !flattened.includes('super secret discord message'),
        'Sanitized payload log should not include raw Discord content'
    );

    const metadata = payloadLog?.find(arg => typeof arg === 'object' && arg !== null) as
        | { model: string; messageCount: number; toolCount: number }
        | undefined;

    assert.ok(metadata, 'Expected metadata object to accompany payload log');
    assert.equal(metadata?.model, 'gpt-5-mini');
    assert.equal(metadata?.messageCount, 1);
    assert.equal(metadata?.toolCount, 0);
});

test('logContextIfVerbose only emits when high verbosity flag is enabled', () => {
    const context: OpenAIMessage[] = [
        { role: 'user', content: 'discord transcript line' }
    ];

    const originalDebug = logger.debug;
    const originalEnv = process.env.DISCORD_BOT_LOG_FULL_CONTEXT;
    const debugCalls: unknown[][] = [];

    logger.debug = ((...args: unknown[]) => {
        debugCalls.push(args);
        return logger;
    }) as typeof logger.debug;

    try {
        delete process.env.DISCORD_BOT_LOG_FULL_CONTEXT;
        logContextIfVerbose(context);
        assert.equal(debugCalls.length, 0, 'High verbosity should be disabled by default');

        process.env.DISCORD_BOT_LOG_FULL_CONTEXT = 'true';
        logContextIfVerbose(context);
        assert.equal(debugCalls.length, 1, 'High verbosity should enable detailed context logging');

        const [logMessage] = debugCalls[0];
        assert.ok(
            typeof logMessage === 'string' && logMessage.includes('Full context'),
            'Verbose log should include the expected prefix'
        );
        assert.ok(
            typeof logMessage === 'string' && logMessage.includes('discord transcript line'),
            'Verbose log should contain the context payload when explicitly enabled'
        );
    } finally {
        if (originalEnv === undefined) {
            delete process.env.DISCORD_BOT_LOG_FULL_CONTEXT;
        } else {
            process.env.DISCORD_BOT_LOG_FULL_CONTEXT = originalEnv;
        }
        logger.debug = originalDebug;
    }
});
