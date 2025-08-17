import { createLogger, format, transports } from 'winston';
import { format as dateFnsFormat } from 'date-fns';

const { combine, timestamp, printf, colorize } = format;

const logFormat = printf(({ level, message, timestamp }) => {
  return `${timestamp} [${level}]: ${message}`;
});

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