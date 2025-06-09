import * as Winston from "winston";
import { EnvConfig } from "./EnvConfig.ts";

export class Logger {
    private static winston: Winston.Logger;

    public static init() {
        let transports: Winston.transport[] = [];

        let consoleLevel = `consoleInfo`;
        if (process.env.NODE_ENV == `test`) {
            consoleLevel = `warn`;
        } else if (EnvConfig.isDevMode) {
            consoleLevel = `http`;
        }

        transports.push(new Winston.transports.Console({
            forceConsole: true,
            level: consoleLevel,
            //silent: process.env.NODE_ENV == `test`,
            consoleWarnLevels: [`consoleWarn`, `warn`, `error`, `debugWarn`],
            format: Winston.format.combine(
                Winston.format.timestamp({ format: `MM/DD/YY HH:mm:ss` }),
                Winston.format.printf(({ timestamp, level, message }) => {
                    return `[BBM ${level.toUpperCase()}] ${timestamp} > ${message}`;
                })
            )
        }));
        transports.push(new Winston.transports.File({
            filename: `storage/logs/bms.log`,
            //filename: `storage/logs/${new Date(Date.now()).toLocaleDateString(`en-US`, { year: `numeric`, month: `numeric`, day: `numeric`}).replaceAll(`/`, `-`)}.log`,
            zippedArchive: true,
            maxsize: 20 * 1024 * 1024,
            silent: process.env.NODE_ENV == `test`,
            maxFiles: 14,
            level: EnvConfig.isDevMode ? `debug` : `info`,
            format: Winston.format.combine(
                Winston.format.timestamp(),
                Winston.format.json()
            )
        }));

        this.winston = Winston.createLogger({
            level: `info`,
            levels: {
                error: 0,
                warn: 1,
                info: 2,
                consoleWarn: 3,
                consoleInfo: 4,
                debugWarn: 5,
                debug: 6,
                http: 7,
            },
            transports: transports,
        });

        Logger.log(`Logger initialized.`);
    }

    public static log(message: string, level = LogLevel.Info): void {
        Logger.winston.log(level, message);
    }

    public static debug(message: any): void {
        Logger.winston.log(LogLevel.Debug, message);
    }

    public static info(message: any): void {
        Logger.winston.log(LogLevel.Info, message);
    }

    public static warn(message: any): void {
        Logger.winston.log(LogLevel.Warn, message);
    }

    public static error(message: any): void {
        Logger.winston.log(LogLevel.Error, message);
    }
}

export enum LogLevel {
    Error = "error",
    Warn = "warn",  
    Info = "info",
    ConsoleWarn = "consoleWarn",
    ConsoleInfo = "consoleInfo",
    DebugWarn = "debugWarn",
    Debug = "debug",
    Http = "http",
}