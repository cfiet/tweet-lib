import * as winston from "winston";

export type Logger = winston.LoggerInstance;
export class LoggerOptions {
  public winston? = {
    transports: {
      console: <winston.ConsoleTransportOptions>{
        colors: true,
        handleExceptions: false,
        humanReadableUnhandledException: true,
        showLevel: true,
        name: "console-logger",
        silent: false,
        timestamp: () =>
          new Date().toISOString()
      }
    }
  }
}

export const defaultLoggingSettings = new LoggerOptions();

export function createCustomLogger(settings: LoggerOptions, ...component: string[]): Logger {
  const label = component.join("/");
  const transports = [];

  if (settings && settings.winston && settings.winston.transports) {
    if (settings.winston.transports.console !== null) {
      let consoleSettings = <winston.ConsoleTransportOptions>Object.create(settings, {
        label: {
          value: label
        }
      });
      transports.push(new winston.transports.Console(consoleSettings));
    }
  }

  return new winston.Logger({
    transports
  });
}

export function createLogger(...component: string[]) {
  return createCustomLogger(defaultLoggingSettings, ...component);
}

export default createLogger;