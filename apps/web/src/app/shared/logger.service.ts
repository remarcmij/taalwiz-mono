import { Injectable } from '@angular/core';

// Log levels in increasing severity
const LEVELS = ['silly', 'debug', 'info', 'warn', 'error', 'fatal', 'none'];

@Injectable({
  providedIn: 'root',
})
export class LoggerService {
  private minLevel = LEVELS.length - 1;

  constructor() {}

  // Return an object with convenience functions for logging at specific
  // log levels.
  setLevel(level: string) {
    const newLevel = LEVELS.indexOf(level);
    if (newLevel !== -1) {
      this.minLevel = newLevel;
    }
  }

  getLevel() {
    return LEVELS[this.minLevel];
  }

  isMinLevel(level: string) {
    return LEVELS.indexOf(level) >= this.minLevel;
  }

  silly(label: string, ...args: unknown[]) {
    this.log('silly', label, ...args);
  }

  debug(label: string, ...args: unknown[]) {
    this.log('debug', label, ...args);
  }

  info(label: string, ...args: unknown[]) {
    this.log('info', label, ...args);
  }

  warn(label: string, ...args: unknown[]) {
    this.log('warn', label, ...args);
  }

  error(label: string, ...args: unknown[]) {
    this.log('error', label, ...args);
  }

  fatal(label: string, ...args: unknown[]) {
    this.log('fatal', label, ...args);
  }

  private log(level: string, label: string, ...args: unknown[]) {
    if (!this.isMinLevel(level)) {
      return;
    }

    let logFn;

    switch (level) {
      case 'warn':
        logFn = console.warn;
        break;
      case 'info':
        logFn = console.info;
        break;
      case 'error':
        logFn = console.error;
        break;
      default:
        logFn = console.log;
    }

    logFn(`${level}: [${label}]`, ...args);
  }
}
