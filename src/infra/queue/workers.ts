import { Worker } from "bullmq";
import IORedis from "ioredis";
import { verifySessionJob } from "@/infra/queue/jobs";
import logger from "@/infra/logger/logger";

const connection = new IORedis({ maxRetriesPerRequest: null });

export const verificationWorker = new Worker("verification_queue", verifySessionJob, {
  connection,
  concurrency: 5,
});

verificationWorker.on("completed", (job) => {
  logger.info("Verification job completed", {
    jobId: job.id,
    sessionId: job.data?.session?.id,
  });
});
