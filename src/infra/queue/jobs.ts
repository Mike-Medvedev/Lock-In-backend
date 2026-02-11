import { verificationService } from "@/features/verification/verification.service";
import { commitmentSessionService } from "@/features/commitment-sessions/commitment-sessions.service";
import { VerificationJobDataModel, type VerificationJob } from "@/infra/queue/jobs.models";
import logger from "@/infra/logger/logger";

/**
 * Verify a completed session: runs the fraud-check pipeline, updates the result,
 * and checks if the commitment is now fulfilled.
 **/
export async function verifySessionJob(job: VerificationJob) {
  logger.info("Beginnning verification job ", { jobId: job.id });
  const result = VerificationJobDataModel.safeParse(job.data);
  if (!result.success) throw result.error;
  const data = result.data;
  const verificationResult = await verificationService.verify(data.session, data.commitmentType);

  if (verificationResult.fraudDetected) {
    return commitmentSessionService.handleFraudDetected(
      data.session.id,
      data.userId,
      data.session.commitmentId,
      verificationResult,
    );
  }

  return commitmentSessionService.handleVerificationPassed(
    data.session.id,
    data.userId,
    data.session.commitmentId,
    verificationResult,
  );
}
