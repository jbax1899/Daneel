import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    ModalBuilder,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
    TextInputBuilder,
    TextInputStyle,
    type InteractionUpdateOptions,
    type MessageActionRowComponentBuilder
} from 'discord.js';
import { buildPromptFieldValue, truncateForEmbed } from './embed.js';
import {
    IMAGE_VARIATION_BACKGROUND_SELECT_PREFIX,
    IMAGE_VARIATION_CANCEL_CUSTOM_ID_PREFIX,
    IMAGE_VARIATION_ASPECT_SELECT_PREFIX,
    IMAGE_VARIATION_GENERATE_CUSTOM_ID_PREFIX,
    IMAGE_VARIATION_PROMPT_INPUT_ID,
    IMAGE_VARIATION_PROMPT_MODAL_ID_PREFIX,
    IMAGE_VARIATION_QUALITY_SELECT_PREFIX,
    IMAGE_VARIATION_RESET_PROMPT_CUSTOM_ID_PREFIX,
    IMAGE_VARIATION_PROMPT_ADJUST_SELECT_PREFIX,
    EMBED_FIELD_VALUE_LIMIT
} from './constants.js';
import { clampPromptForContext, formatRetryCountdown, formatStylePreset, toTitleCase } from './sessionHelpers.js';
import { buildQualityTokenDescription } from '../../utils/imageTokens.js';
import type { ImageGenerationContext } from './followUpCache.js';
import type {
    ImageBackgroundType,
    ImageQualityType,
    ImageRenderModel,
    ImageSizeType,
    ImageStylePreset,
    ImageTextModel
} from './types.js';

/**
 * Represents the per-user configuration state for a variation session. We keep
 * this information in memory while the user is interacting with the ephemeral
 * configurator so that select/menu events can update the preview without
 * losing the in-progress choices.
 */
export interface VariationSessionState {
    key: string;
    userId: string;
    responseId: string;
    prompt: string;
    originalPrompt: string;
    refinedPrompt: string | null;
    textModel: ImageTextModel;
    imageModel: ImageRenderModel;
    size: ImageSizeType;
    aspectRatio: ImageGenerationContext['aspectRatio'];
    aspectRatioLabel: string;
    quality: ImageQualityType;
    background: ImageBackgroundType;
    style: ImageStylePreset;
    allowPromptAdjustment: boolean;
    timeout: NodeJS.Timeout;
    cooldownUntil: number | null;
    cooldownTimer?: NodeJS.Timeout;
    messageUpdater?: (options: InteractionUpdateOptions) => Promise<unknown>;
    statusMessage: string | null;
}

type VariationConfiguratorView = {
    content?: string;
    embeds: EmbedBuilder[];
    components: ActionRowBuilder<MessageActionRowComponentBuilder>[];
};

const VARIATION_SESSION_TTL_MS = 10 * 60 * 1000;
const sessions = new Map<string, VariationSessionState>();

const QUALITY_OPTIONS: Array<{ value: ImageQualityType; label: string; description: string }> = [
    { value: 'low', label: 'Low', description: buildQualityTokenDescription('low') },
    { value: 'medium', label: 'Medium', description: buildQualityTokenDescription('medium') },
    { value: 'high', label: 'High', description: buildQualityTokenDescription('high') }
];

const ASPECT_OPTIONS: Array<{ value: ImageGenerationContext['aspectRatio']; label: string }> = [
    { value: 'auto', label: 'Auto' },
    { value: 'square', label: 'Square' },
    { value: 'portrait', label: 'Portrait' },
    { value: 'landscape', label: 'Landscape' }
];

const BACKGROUND_OPTIONS: Array<{ value: ImageBackgroundType; label: string }> = [
    { value: 'auto', label: 'Auto' },
    { value: 'transparent', label: 'Transparent' },
    { value: 'opaque', label: 'Opaque' }
];

// Select menus are limited to four rows, so the "style" selector now doubles as a
// toggle for whether the AI may refine the prompt. Providing a description keeps
// the intent crystal-clear when users revisit the configurator.
const PROMPT_ADJUSTMENT_OPTIONS: Array<{ value: 'allow' | 'deny'; label: string; description: string }> = [
    {
        value: 'allow',
        label: 'Let Daneel improve the prompt',
        description: 'Refine wording for better results'
    },
    {
        value: 'deny',
        label: 'Use exactly what I wrote',
        description: 'Skip all prompt adjustments'
    }
];

function makeSessionKey(userId: string, responseId: string): string {
    return `${userId}:${responseId}`;
}

function scheduleExpiry(session: VariationSessionState): void {
    clearTimeout(session.timeout);
    session.timeout = setTimeout(() => {
        disposeVariationSession(session.key);
    }, VARIATION_SESSION_TTL_MS);
}

function clearCooldown(session: VariationSessionState): void {
    if (session.cooldownTimer) {
        clearTimeout(session.cooldownTimer);
        session.cooldownTimer = undefined;
    }
    session.cooldownUntil = null;
}

export function initialiseVariationSession(
    userId: string,
    responseId: string,
    context: ImageGenerationContext
): VariationSessionState {
    const key = makeSessionKey(userId, responseId);
    disposeVariationSession(key);

    const normalizedOriginal = clampPromptForContext(context.originalPrompt ?? context.prompt);
    const normalizedRefined = context.refinedPrompt ? clampPromptForContext(context.refinedPrompt) : null;
    const initialPrompt = clampPromptForContext(context.refinedPrompt ?? context.prompt);

    const session: VariationSessionState = {
        key,
        userId,
        responseId,
        prompt: initialPrompt,
        originalPrompt: normalizedOriginal,
        refinedPrompt: normalizedRefined,
        textModel: context.textModel,
        imageModel: context.imageModel,
        size: context.size,
        aspectRatio: context.aspectRatio,
        aspectRatioLabel: context.aspectRatioLabel,
        quality: context.quality,
        background: context.background,
        style: context.style,
        allowPromptAdjustment: context.allowPromptAdjustment ?? true,
        timeout: setTimeout(() => {
            disposeVariationSession(key);
        }, VARIATION_SESSION_TTL_MS),
        cooldownUntil: null,
        messageUpdater: undefined,
        statusMessage: null
    };

    sessions.set(key, session);
    return session;
}

export function getVariationSession(userId: string, responseId: string): VariationSessionState | null {
    return sessions.get(makeSessionKey(userId, responseId)) ?? null;
}

export function updateVariationSession(
    userId: string,
    responseId: string,
    updater: (session: VariationSessionState) => void
): VariationSessionState | null {
    const session = getVariationSession(userId, responseId);
    if (!session) {
        return null;
    }

    updater(session);
    scheduleExpiry(session);
    return session;
}

export function setVariationSessionUpdater(
    userId: string,
    responseId: string,
    updater: (options: InteractionUpdateOptions) => Promise<unknown>
): VariationSessionState | null {
    const session = getVariationSession(userId, responseId);
    if (!session) {
        return null;
    }

    session.messageUpdater = updater;
    scheduleExpiry(session);
    return session;
}

export function disposeVariationSession(key: string): void {
    const session = sessions.get(key);
    if (!session) {
        return;
    }

    clearTimeout(session.timeout);
    clearCooldown(session);
    sessions.delete(key);
}

export function applyVariationCooldown(
    userId: string,
    responseId: string,
    seconds: number
): VariationSessionState | null {
    const session = getVariationSession(userId, responseId);
    if (!session) {
        return null;
    }

    clearCooldown(session);
    if (seconds > 0) {
        session.cooldownUntil = Date.now() + seconds * 1000;
        if (session.messageUpdater) {
            session.cooldownTimer = setTimeout(async () => {
                session.cooldownTimer = undefined;
                session.cooldownUntil = null;
                try {
                    if (session.messageUpdater) {
                        await session.messageUpdater(buildVariationConfiguratorView(session));
                    }
                } catch {
                    // Ignore refresh errors; the user may have closed the configurator.
                }
            }, seconds * 1000);
        }
    }

    scheduleExpiry(session);
    return session;
}

export function resetVariationCooldown(userId: string, responseId: string): VariationSessionState | null {
    const session = getVariationSession(userId, responseId);
    if (!session) {
        return null;
    }

    clearCooldown(session);
    scheduleExpiry(session);
    return session;
}

function buildSelectRow(
    customId: string,
    options: Array<{ value: string; label: string; description?: string }>,
    {
        selectedValue,
        placeholder,
        currentLabel
    }: { selectedValue: string; placeholder: string; currentLabel?: string }
): ActionRowBuilder<MessageActionRowComponentBuilder> {
    const selectedOption = options.find(option => option.value === selectedValue);
    const placeholderLabel = currentLabel ?? selectedOption?.label ?? 'previous setting';

    const menu = new StringSelectMenuBuilder()
        .setCustomId(customId)
        .setMinValues(0)
        .setMaxValues(1)
        .setPlaceholder(`${placeholder} (current: ${placeholderLabel})`)
        .addOptions(options.map(option => {
            const optionBuilder = new StringSelectMenuOptionBuilder()
                .setLabel(option.label)
                .setValue(option.value);

            if (option.description) {
                optionBuilder.setDescription(option.description);
            }

            return optionBuilder;
        }));

    return new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(menu);
}

export function buildVariationConfiguratorView(
    session: VariationSessionState,
    options: { statusMessage?: string } = {}
): VariationConfiguratorView {
    if (options.statusMessage !== undefined) {
        session.statusMessage = options.statusMessage;
    }

    const statusText = options.statusMessage ?? session.statusMessage ?? 'Tweak the settings below and press **Generate variation** when you are ready.';
    const embed = new EmbedBuilder()
        .setTitle('🎨 Configure image variation')
        .setDescription(
            truncateForEmbed(
                statusText,
                2048
            )
        );

    embed.addFields({
        name: 'Current prompt',
        value: buildPromptFieldValue(session.prompt, { label: 'variation prompt' })
    });

    if (session.originalPrompt && session.originalPrompt !== session.prompt) {
        embed.addFields({
            name: 'Original prompt',
            value: buildPromptFieldValue(session.originalPrompt, { label: 'original prompt' })
        });
    }

    if (session.refinedPrompt && session.refinedPrompt !== session.prompt && session.refinedPrompt !== session.originalPrompt) {
        embed.addFields({
            name: 'Last refined prompt',
            value: buildPromptFieldValue(session.refinedPrompt, { label: 'refined prompt' })
        });
    }

    embed.addFields(
        {
            name: 'Quality',
            value: `${toTitleCase(session.quality)} (${session.imageModel})`,
            inline: true
        },
        {
            name: 'Aspect ratio',
            value: session.aspectRatioLabel,
            inline: true
        },
        {
            name: 'Resolution',
            value: session.size === 'auto' ? 'Auto' : session.size,
            inline: true
        },
        {
            name: 'Background',
            value: toTitleCase(session.background),
            inline: true
        },
        {
            name: 'Style',
            value: formatStylePreset(session.style),
            inline: true
        },
        {
            name: 'Prompt adjustment',
            value: session.allowPromptAdjustment ? 'Enabled' : 'Disabled',
            inline: true
        },
        {
            name: 'Text model',
            value: session.textModel,
            inline: true
        },
        {
            name: 'Image model',
            value: session.imageModel,
            inline: true
        }
    );

    const rows: ActionRowBuilder<MessageActionRowComponentBuilder>[] = [
        buildSelectRow(
            `${IMAGE_VARIATION_QUALITY_SELECT_PREFIX}${session.responseId}`,
            QUALITY_OPTIONS,
            {
                selectedValue: session.quality,
                placeholder: 'Select quality',
                currentLabel: toTitleCase(session.quality)
            }
        ),
        buildSelectRow(
            `${IMAGE_VARIATION_ASPECT_SELECT_PREFIX}${session.responseId}`,
            ASPECT_OPTIONS,
            {
                selectedValue: session.aspectRatio,
                placeholder: 'Select aspect ratio',
                currentLabel: session.aspectRatioLabel
            }
        ),
        buildSelectRow(
            `${IMAGE_VARIATION_BACKGROUND_SELECT_PREFIX}${session.responseId}`,
            BACKGROUND_OPTIONS,
            {
                selectedValue: session.background,
                placeholder: 'Select background',
                currentLabel: toTitleCase(session.background)
            }
        ),
        buildSelectRow(
            `${IMAGE_VARIATION_PROMPT_ADJUST_SELECT_PREFIX}${session.responseId}`,
            PROMPT_ADJUSTMENT_OPTIONS,
            {
                selectedValue: session.allowPromptAdjustment ? 'allow' : 'deny',
                placeholder: 'Select if AI improves prompt',
                currentLabel: session.allowPromptAdjustment ? 'Enabled' : 'Disabled'
            }
        )
    ];

    const now = Date.now();
    const onCooldown = Boolean(session.cooldownUntil && session.cooldownUntil > now);
    const countdown = onCooldown && session.cooldownUntil
        ? formatRetryCountdown(Math.max(0, Math.ceil((session.cooldownUntil - now) / 1000)))
        : null;

    const actionButton = new ButtonBuilder()
        .setCustomId(`${IMAGE_VARIATION_GENERATE_CUSTOM_ID_PREFIX}${session.responseId}`)
        .setStyle(onCooldown ? ButtonStyle.Secondary : ButtonStyle.Primary)
        .setDisabled(Boolean(onCooldown))
        .setLabel(onCooldown && countdown ? `Retry image generation (${countdown})` : 'Generate variation');

    const editPromptButton = new ButtonBuilder()
        .setCustomId(`${IMAGE_VARIATION_PROMPT_MODAL_ID_PREFIX}${session.responseId}`)
        .setLabel('Edit prompt')
        .setStyle(ButtonStyle.Secondary);

    const resetPromptButton = new ButtonBuilder()
        .setCustomId(`${IMAGE_VARIATION_RESET_PROMPT_CUSTOM_ID_PREFIX}${session.responseId}`)
        .setLabel('Reset to original prompt')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(session.prompt === session.originalPrompt);

    const cancelButton = new ButtonBuilder()
        .setCustomId(`${IMAGE_VARIATION_CANCEL_CUSTOM_ID_PREFIX}${session.responseId}`)
        .setLabel('Cancel')
        .setStyle(ButtonStyle.Danger);

    const promptButtons = new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
        editPromptButton,
        resetPromptButton,
        actionButton,
        cancelButton
    );

    rows.push(promptButtons);

    return {
        embeds: [embed],
        components: rows
    };
}

export function buildPromptModal(responseId: string, currentPrompt: string): ModalBuilder {
    const modal = new ModalBuilder()
        .setCustomId(`${IMAGE_VARIATION_PROMPT_MODAL_ID_PREFIX}${responseId}`)
        .setTitle('Update variation prompt');

    const promptInput = new TextInputBuilder()
        .setCustomId(IMAGE_VARIATION_PROMPT_INPUT_ID)
        .setLabel('Prompt to send to the model')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setMaxLength(EMBED_FIELD_VALUE_LIMIT)
        .setValue(clampPromptForContext(currentPrompt));

    return modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(promptInput));
}
