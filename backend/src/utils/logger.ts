import pino from "pino";

type LogLevel =
  | "fatal"
  | "error"
  | "warn"
  | "info"
  | "debug"
  | "trace"
  | "silent";

const levels = ["fatal", "error", "warn", "info", "debug", "trace", "silent"];
const envLevel = process.env.LOG_LEVEL?.toLowerCase();
const level = levels.includes(envLevel as string) ? (envLevel as LogLevel) : "info";

const isProduction = process.env.NODE_ENV === "production";

const logger = pino({
  level,
  prettyPrint: isProduction
    ? false
    : {
        colorize: true,
        ignore: "pid,hostname",
        translateTime: "SYS:standard"
      }
});

export { logger };
