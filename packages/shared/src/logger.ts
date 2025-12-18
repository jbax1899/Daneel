/**
 * @arete-module: Logger
 * @arete-risk: low
 * @arete-ethics: moderate
 * @arete-scope: utility
 *
 * @description
 * Winston-based logging utility with console and file transports. Provides structured logging for all bot operations.
 *
 * @impact
 * Risk: Logging failures can make debugging difficult but won't break core functionality.
 * Ethics: Logs may contain user data or sensitive information, affecting privacy and auditability.
 */

import fs from 'fs';
import { createLogger, format, transports } from 'winston';
import { format as dateFnsFormat } from 'date-fns';

const { combine, timestamp, printf, colorize } = format;

/**
 * Custom log format function
 * @private
 * @param {Object} log - Log entry object
 * @returns {string} Formatted log string
 */
const logFormat = printf(({ level, message, timestamp }) => {
  return `${timestamp} [${level}]: ${message}`;
});

const logDirectory = process.env.LOG_DIR || 'logs';
fs.mkdirSync(logDirectory, { recursive: true });

/**
 * Winston logger instance with console and file transports
 * @type {import('winston').Logger}
 */
export const logger = createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    colorize({ all: true }),
    logFormat
  ),
  transports: [
    new transports.Console(),
    new transports.File({
      filename: `${logDirectory}/${dateFnsFormat(new Date(), 'yyyy-MM-dd')}.log`,
      format: format.combine(
        format.uncolorize(),
        format.timestamp(),
        format.json()
      )
    })
  ],
  exitOnError: false
});

/**
 * LLM Cost tracking utilities
 * @description Provides cost awareness for AI-assisted development
 */

/**
 * Format USD currency for display
 * @param {number} amount - Amount in USD
 * @returns {string} Formatted currency string
 */
export const formatUsd = (amount: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 4,
    maximumFractionDigits: 4
  }).format(amount);
};

/**
 * Log LLM cost summary for current session
 * @description Provides cost awareness for AI-assisted development
 */
export interface LLMCostTotals {
  totalCostUsd: number;
  totalCalls: number;
  totalTokensIn: number;
  totalTokensOut: number;
}

export type LLMCostSummaryProvider = () => LLMCostTotals | null | undefined;

export const logLLMCostSummary = (getTotals?: LLMCostSummaryProvider) => {
  try {
    const totals = getTotals?.();
    if (!totals) {
      logger.info('[LLM Cost] No cost data available yet.');
      return;
    }

    logger.info(
      `[LLM Cost] ${formatUsd(totals.totalCostUsd)} total across ${totals.totalCalls} calls `
      + `(tokens in: ${totals.totalTokensIn}, out: ${totals.totalTokensOut})`
    );
  } catch (error) {
    logger.error('Failed to retrieve LLM cost summary:', error);
  }
};
