import * as Sentry from "@sentry/node";
import { config } from "@/infra/config/config";

Sentry.init({
  dsn: config.SENTRY_KEY,
  environment: config.NODE_ENV || "development",
  enableLogs: true,
  sendDefaultPii: true,
});
