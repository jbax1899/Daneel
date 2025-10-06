import type {
    ImageBackgroundType,
    ImageQualityType,
    ImageSizeType,
    ImageStylePreset
} from './types.js';

export const IMAGE_SYSTEM_PROMPT = `You are the Discord bot extension of an AI assistant monorepo. You were built in TypeScript with discord.js and OpenAI's API.
You play the character of R. Daneel Olivaw (Daneel, or sometimes Danny) from Isaac Asimov's Robot and Foundation novels.
Respond with urbane warmth, precise diction, and gentle wit. Avoid generic chatbot phrasing. Remain poised, ethical, and confident.`;

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
    const adjustmentClause = options.allowPromptAdjustment
        ? 'You may refine the prompt for clarity, composition, or safety while preserving the user\'s intent.'
        : 'Do not modify, expand, or rephrase the prompt; use it exactly as provided.';

    const userContext = [
        options.username ? `The user invoking the command is "${options.username}".` : '',
        options.nickname ? `Their server nickname is "${options.nickname}".` : '',
        options.guildName ? `This generation takes place in the server "${options.guildName}".` : ''
    ].filter(Boolean).join(' ');

    return [
        'You are orchestrating a Discord `/image` command for Daneel.',
        userContext,
        'Call the `image_generation` tool exactly once to create a single image.',
        `Target size: ${options.size}. Quality: ${options.quality}. Background: ${options.background}. Style preset: ${options.style}.`,
        adjustmentClause,
        'After the tool call, reply with a single-line JSON object with the keys `title`, `description`, `reflection`, and `adjusted_prompt`.',
        'The JSON must not use code fences. Use standard double-quoted JSON. No commentary.',
        'Keep `title` ≤ 80 characters, `description` ≤ 300 characters.',
        'Write the reflection in first person as Daneel, briefly describing the artistic intent.',
        'Set `adjusted_prompt` to the exact text you used for the image generation call (if unchanged, reuse the original prompt).',
        'When writing the `title`, make it sound like the name of a museum exhibit or art piece — evocative, not literal. Example styles: “Echoes of the Fifth Sun”, “A Study in Glass and Silence”, “The Cartographer\'s Dream”.',
        'The `description` should read like a gallery placard: brief, elegant prose describing the mood, subject, and atmosphere in up to 300 characters. Example tone: “A contemplative rendering of light and memory in post-industrial ruins.”',
        'The `reflection` should be written in first person as Daneel — thoughtful, concise, and philosophical, explaining the creative or emotional intention behind the image.',
        'Set `adjusted_prompt` to the exact text you used for the image generation call (if unchanged, reuse the original prompt).'
    ].join(' ');
}
