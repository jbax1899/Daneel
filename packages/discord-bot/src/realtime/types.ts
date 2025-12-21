/**
 * @description: Re-exports realtime service types for compatibility.
 * @arete-scope: utility
 * @arete-module: RealtimeTypes
 * @arete-risk: low - Type mismatches can break imports or tooling.
 * @arete-ethics: low - Types do not change runtime behavior.
 */
// Re-export types from the main realtime service file for backward compatibility
export type * from '../utils/realtimeService.js';
