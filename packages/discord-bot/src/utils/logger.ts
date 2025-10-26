/**
 * @file logger.ts
 * @description Winston-based logging utility with console and file transports
 */

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
      filename: `logs/${dateFnsFormat(new Date(), 'yyyy-MM-dd')}.log`,
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
export const logLLMCostSummary = () => {
  // This would integrate with your existing LLMCostEstimator
  // For now, providing the interface structure
  try {
    // const totals = LLMCostEstimator.getCumulativeTotals();
    // logger.info(`[LLM Cost] ${formatUsd(totals.usdTotal)} total this session`);
    logger.info('[LLM Cost] Cost tracking interface ready for integration');
  } catch (error) {
    logger.error('Failed to retrieve LLM cost summary:', error);
  }
};