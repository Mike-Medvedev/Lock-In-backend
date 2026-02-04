import { createLogger, transports, format } from "winston";
import chalk from "chalk";

const logger = createLogger({
  level: "info",
  transports: [new transports.Console()],
  format: format.combine(
    format.errors({ stack: true }),
    format.timestamp(),
    format.colorize(),
    format.printf((info) => {
      const { timestamp, level, message, requestId, method, path, stack, ...meta } = info;

      const requestContext =
        requestId && method && path ? ` ${chalk.blue(`[${requestId} ${method} ${path}]`)}` : "";

      const loggerMetadata = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : "";

      return `${timestamp} ${level}:${requestContext} ${message}${loggerMetadata}${stack ? "\n" + stack : ""}`;
    }),
  ),
});
export default logger;
