/**
 * Development Logger Utility
 * Centralized logging that only runs in development
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

class Logger {
  private isDev = import.meta.env.DEV;

  private log(level: LogLevel, message: string, data?: any) {
    if (!this.isDev) return;

    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level.toUpperCase()}]`;

    switch (level) {
      case 'debug':
        console.debug(prefix, message, data || '');
        break;
      case 'info':
        console.info(prefix, message, data || '');
        break;
      case 'warn':
        console.warn(prefix, message, data || '');
        break;
      case 'error':
        console.error(prefix, message, data || '');
        break;
    }
  }

  debug(message: string, data?: any) {
    this.log('debug', message, data);
  }

  info(message: string, data?: any) {
    this.log('info', message, data);
  }

  warn(message: string, data?: any) {
    this.log('warn', message, data);
  }

  error(message: string, data?: any) {
    this.log('error', message, data);
  }

  // Specialized logging for IFC parsing
  parsing = {
    start: (fileName: string) => {
      this.info(`Starting IFC parse: ${fileName}`);
    },
    progress: (percentage: number, message: string) => {
      this.debug(`Parse progress: ${percentage}%`, message);
    },
    complete: (entityCount: number, parseTime: number) => {
      this.info(`Parse complete: ${entityCount} entities in ${parseTime}ms`);
    },
    error: (error: Error, context?: string) => {
      this.error(`Parse error${context ? ` (${context})` : ''}:`, error);
    },
  };

  // Specialized logging for validation
  validation = {
    start: (entityCount: number) => {
      this.info(`Starting validation for ${entityCount} entities`);
    },
    complete: (errorCount: number, warningCount: number) => {
      this.info(`Validation complete: ${errorCount} errors, ${warningCount} warnings`);
    },
  };

  // Specialized logging for graph operations
  graph = {
    filterApplied: (filterType: string, resultCount: number) => {
      this.debug(`Filter applied: ${filterType}, ${resultCount} nodes remaining`);
    },
    lodChanged: (newLoD: number) => {
      this.info(`Graph LoD changed to: ${newLoD}`);
    },
  };
}

export const logger = new Logger();
