import { createLogger, format, transports, Logger, transport, } from "winston";
import { TransformableInfo } from "logform";

const { combine, timestamp, json, colorize, printf } = format;

const consoleLogFormat = combine(
  colorize(),
  printf((info: TransformableInfo) => {
    return `${info.level}: ${String(info.message)}`;
  })
);

const fileLogFormat = combine(
  timestamp(),
  json()
);

const logger: Logger = createLogger({
  level: "info",
  transports: [
    new transports.Console({
      format: consoleLogFormat,
    }),
    new transports.File({
      filename: "logs/app.log",
      format: fileLogFormat,
    }),
  ] as transport[]
});

export default logger;
