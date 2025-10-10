import { renderPrompt } from '../env.js';
export class RealtimeContextBuilder {
    buildContext(input) {
        const transcripts = input.transcripts ?? [];
        const roster = input.participants.length > 0
            ? input.participants
                .map(participant => `- ${participant.displayName}${participant.isBot ? ' (bot)' : ''}`)
                .join('\n')
            : '- (no other participants currently detected)';
        const transcriptBlock = transcripts.length > 0
            ? `\nRecent conversation summary:\n${transcripts.map((line) => `- ${line}`).join('\n')}`
            : '';
        const basePrompt = renderPrompt('discord.realtime.system').content;
        const instructions = `${basePrompt}\n\nParticipants currently in the voice channel:\n${roster}${transcriptBlock}`;
        return {
            instructions,
            metadata: {
                participants: input.participants,
                transcripts,
            },
        };
    }
}
//# sourceMappingURL=RealtimeContextBuilder.js.map