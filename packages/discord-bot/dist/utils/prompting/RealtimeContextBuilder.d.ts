export interface RealtimeContextParticipant {
    id: string;
    displayName: string;
    isBot?: boolean;
}
export interface RealtimeContextInput {
    participants: RealtimeContextParticipant[];
    transcripts?: string[];
}
interface RealtimeContextOutput {
    instructions: string;
    metadata: {
        participants: RealtimeContextParticipant[];
        transcripts: string[];
    };
}
export declare class RealtimeContextBuilder {
    buildContext(input: RealtimeContextInput): RealtimeContextOutput;
}
export {};
