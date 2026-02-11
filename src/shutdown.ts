import logger from "@/infra/logger/logger";
import { client as db } from "@/infra/db/db.ts";
import { verificationWorker } from "@/infra/queue/workers";
import { verificationQueue } from "@/infra/queue/queue";
import type { Server } from "http";

export default function gracefulShutdown(server: Server) {
  const shutdown = (signal: string) => {
    logger.info({ message: `Shutting down with signal: ${signal}` });
    server.close(async (err): Promise<void> => {
      if (err) {
        logger.error({ message: "Error closing server", err });
        process.exit(1);
      }
      try {
        logger.info("Closing BullMQ worker and queue...");
        await verificationWorker.close();
        await verificationQueue.close();
        await db.end();
      } finally {
        process.exit(0);
      }
    });
    setTimeout(() => {
      logger.error({ message: "Forced shutdown timeout" });
      process.exit(1);
    }, 10_000).unref();
  };

  ["SIGTERM", "SIGINT"].forEach((sig) => process.on(sig, () => shutdown(sig)));
  process.on("unhandledRejection", (reason) => {
    logger.error({
      message: "unhandledRejection",
      err: reason instanceof Error ? reason : new Error(String(reason)),
    });
  });
  process.on("uncaughtException", (err) => {
    logger.error({ message: "uncaughtException", err });
    shutdown("uncaughtException");
  });
}
