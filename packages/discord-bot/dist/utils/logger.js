import { createLogger, format, transports } from 'winston';
import { format as dateFnsFormat } from 'date-fns';
const { combine, timestamp, printf, colorize } = format;
const logFormat = printf(({ level, message, timestamp }) => {
    return `${timestamp} [${level}]: ${message}`;
});
export const logger = createLogger({
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    format: combine(timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), colorize({ all: true }), logFormat),
    transports: [
        new transports.Console(),
        new transports.File({
            filename: `logs/${dateFnsFormat(new Date(), 'yyyy-MM-dd')}.log`,
            format: format.combine(format.uncolorize(), format.timestamp(), format.json())
        })
    ],
    exitOnError: false
});
// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    logger.error(`Uncaught Exception: ${error.message}`, { error });
    process.exit(1);
});
// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});
//# sourceMappingURL=logger.js.map