import * as path from 'path';
import { fileURLToPath } from 'url';
import { createLogger, format, transports } from 'winston';

const { combine, timestamp, label, printf } = format;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const myFormat = printf(({ level, message, timestamp, email, error }: any) => {
  let text = `${timestamp} ${level}: ${message}`;
  if (error) {
    text += `, error ${error}`;
  }

  if (email) {
    text += `, user ${email}`;
  }
  return text;
});

let level: string;

switch (process.env.NODE_ENV) {
  case 'production':
    level = 'info';
    break;
  case 'test':
    level = 'fatal';
    break;
  default:
    level = 'silly';
}

const logger = createLogger({
  level,
  format: combine(label({ label: 'taalwiz' }), timestamp(), myFormat),
  transports: [new transports.Console()],
});

export default logger;
