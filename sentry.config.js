import * as Sentry from "@sentry/node";
import { env } from "@/infra/env";

Sentry.init({
  dsn: env.SENTRY_KEY,
  environment: env.NODE_ENV || "development",
  enableLogs: true,
  sendDefaultPii: true,
});
