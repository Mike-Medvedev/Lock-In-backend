import * as Sentry from "@sentry/node";
import { env } from "@/settings/env.ts";

Sentry.init({
  dsn: env.SENTRY_KEY,
  environment: env.NODE_ENV || "development",
  enableLogs: true,
  sendDefaultPii: true,
});
