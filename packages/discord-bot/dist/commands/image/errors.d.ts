import type { Response } from 'openai/resources/responses/responses.js';
export declare function mapResponseError(error: NonNullable<Response['error']>): string;
export declare function resolveImageCommandError(error: unknown): string;
