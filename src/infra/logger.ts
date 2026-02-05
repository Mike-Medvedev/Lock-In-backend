import { createLogger, transports, format } from "winston";
import chalk from "chalk";
import Transport from "winston-transport";
import * as Sentry from "@sentry/node";

const SentryWinstonTransport = Sentry.createSentryWinstonTransport(Transport);

const logger = createLogger({
  level: "info",
  transports: [new transports.Console(), new SentryWinstonTransport()],
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
