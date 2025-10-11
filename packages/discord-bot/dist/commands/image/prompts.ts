import { renderPrompt } from '../../utils/env.js';

import type {
    ImageBackgroundType,
    ImageQualityType,
    ImageSizeType,
    ImageStylePreset
} from './types.js';


interface DeveloperPromptOptions {
    allowPromptAdjustment: boolean;
    size: ImageSizeType;
    quality: ImageQualityType;
    background: ImageBackgroundType;
    style: ImageStylePreset;
    username: string; // Discord username of the user that called the command
    nickname: string; // Discord nickname of the user that called the command
    guildName: string; // Discord server name where the command was called
}

export function buildDeveloperPrompt(options: DeveloperPromptOptions): string {
    const sanitize = (value: string | null | undefined): string | null => {
        if (!value) {
            return null;
        }

        return value.replace(/"/g, '\\"');
    };

    const adjustmentClause = options.allowPromptAdjustment
        ? 'You may refine the prompt for clarity, composition, or safety while preserving the user\'s intent.'
        : 'Do not modify, expand, or rephrase the prompt; use it exactly as provided.';

    const safeUsername = sanitize(options.username);
    const safeNickname = sanitize(options.nickname);
    const safeGuildName = sanitize(options.guildName);
    const requesterName = safeNickname || safeUsername || null;

    const userContext = [
        safeUsername ? `The user invoking the command is "${safeUsername}".` : '',
        safeNickname ? `Their server nickname is "${safeNickname}".` : '',
        safeGuildName ? `This generation takes place in the server "${safeGuildName}".` : ''
    ].filter(Boolean).join(' ');

    const reflectionInstruction = requesterName
        ? `The reflection must address "${requesterName}" by name and explore the creative intent in two or three sentences.`
        : 'The reflection must explore the creative intent in two or three sentences.';

    const { content } = renderPrompt('discord.image.developer', {
        userContext,
        size: options.size,
        quality: options.quality,
        background: options.background,
        style: options.style,
        adjustmentClause,
        reflectionInstruction
    });

    return content;
}
