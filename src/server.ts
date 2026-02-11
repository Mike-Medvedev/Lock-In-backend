import "dotenv/config";
import "@root/sentry.config.js";
import "@root/meebo.config";
import "@/infra/queue/workers";

import { config } from "@/infra/config/config";
import logger from "@/infra/logger/logger";
import gracefulShutdown from "@/shutdown.ts";
import app from "./app";

const server = app.listen(config.PORT, "0.0.0.0", (): void => {
  logger.info(`Server listening on port ${config.PORT}`);
});
if (config.NODE_ENV === "production") {
  gracefulShutdown(server);
}
