import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { getTestAuth } from "@/tests/helpers/auth";
import {
  insertActiveCommitment,
  insertCompletedSessionWithSamples,
  deleteCommitment,
  closeDb,
} from "@/tests/helpers/db";
import { db } from "@/infra/db/db";
import { commitmentSessions, commitments } from "@/infra/db/schema";
import { eq } from "drizzle-orm";
import { verifySessionJob } from "@/infra/queue/jobs";
import { payloads } from "@/tests/integration/fixtures/commitments.fixtures";

let userId: string;
const createdCommitmentIds: string[] = [];

beforeAll(async () => {
  ({ userId } = await getTestAuth());
  await db.delete(commitments).where(eq(commitments.userId, userId));
});

beforeEach(async () => {
  createdCommitmentIds.length = 0;
});

afterAll(async () => {
  for (const id of createdCommitmentIds) {
    await deleteCommitment(id).catch(() => {});
  }
  await closeDb();
});

describe("verifySessionJob", () => {
  it("verifies a session that passes fraud checks and updates DB", async () => {
    const commitment = await insertActiveCommitment(userId);
    createdCommitmentIds.push(commitment.id);

    const countingDay = "2026-02-09";
    const raw = payloads.movementDataForSession(countingDay);
    const movementData = {
      motionSamples: raw.motionSamples.map((s) => ({ ...s, capturedAt: new Date(s.capturedAt) })),
      gpsSamples: raw.gpsSamples.map((s) => ({ ...s, capturedAt: new Date(s.capturedAt) })),
      pedometerSamples: raw.pedometerSamples.map((s, i) => ({
        ...s,
        capturedAt: new Date(s.capturedAt),
        steps: (i + 1) * 500,
      })),
    };
    const session = await insertCompletedSessionWithSamples(
      commitment.id,
      userId,
      countingDay,
      movementData,
    );

    const job = {
      id: "test-job-1",
      data: {
        session: {
          id: session.id,
          userId: session.userId,
          commitmentId: session.commitmentId,
          startDate: session.startDate,
          endDate: session.endDate,
          createdAt: session.createdAt,
          completedAt: session.completedAt,
          timezone: session.timezone,
          countingDay: session.countingDay,
          sessionDuration: session.sessionDuration,
          sessionStatus: session.sessionStatus,
          verificationStatus: session.verificationStatus,
          sessionGoal: session.sessionGoal,
          actualValue: session.actualValue,
          flaggedForReview: session.flaggedForReview,
          fraudDetected: session.fraudDetected,
          reviewNotes: session.reviewNotes,
        },
        commitmentType: "walk" as const,
        userId,
      },
    };

    const result = await verifySessionJob(job as Parameters<typeof verifySessionJob>[0]);

    expect(result).toBeDefined();
    expect(result.verificationStatus).toBe("succeeded");

    const [updated] = await db
      .select()
      .from(commitmentSessions)
      .where(eq(commitmentSessions.id, session.id));
    expect(updated?.verificationStatus).toBe("succeeded");
    expect(updated?.actualValue).toBe(2000);
  });

  it("marks session as failed when fraud is detected (insufficient data)", async () => {
    const commitment = await insertActiveCommitment(userId);
    createdCommitmentIds.push(commitment.id);

    const countingDay = "2026-02-10";
    const session = await insertCompletedSessionWithSamples(commitment.id, userId, countingDay, {
      motionSamples: [],
      gpsSamples: [],
      pedometerSamples: [],
    });

    const job = {
      id: "test-job-2",
      data: {
        session: {
          id: session.id,
          userId: session.userId,
          commitmentId: session.commitmentId,
          startDate: session.startDate,
          endDate: session.endDate,
          createdAt: session.createdAt,
          completedAt: session.completedAt,
          timezone: session.timezone,
          countingDay: session.countingDay,
          sessionDuration: session.sessionDuration,
          sessionStatus: session.sessionStatus,
          verificationStatus: session.verificationStatus,
          sessionGoal: session.sessionGoal,
          actualValue: session.actualValue,
          flaggedForReview: session.flaggedForReview,
          fraudDetected: session.fraudDetected,
          reviewNotes: session.reviewNotes,
        },
        commitmentType: "walk" as const,
        userId,
      },
    };

    const result = await verifySessionJob(job as Parameters<typeof verifySessionJob>[0]);

    expect(result).toBeDefined();
    expect(result.verificationStatus).toBe("failed");
    expect(result.fraudDetected).toBe(true);

    const [updated] = await db
      .select()
      .from(commitmentSessions)
      .where(eq(commitmentSessions.id, session.id));
    expect(updated?.verificationStatus).toBe("failed");
    expect(updated?.fraudDetected).toBe(true);
  });
});
