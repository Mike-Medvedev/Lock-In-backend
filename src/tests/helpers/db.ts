import { db, client as dbConnection } from "@/infra/db/db";
import { commitments, commitmentSessions, transactions } from "@/infra/db/schema";
import { eq } from "drizzle-orm";
import { addTime } from "@/shared/date";
import { DURATION_WEEKS } from "@/shared/constants";
import { sessionSampleService } from "@/features/session-samples/session-sample.service";
import { poolService } from "@/features/pool/pool.service";

/**
 * Insert a commitment directly into the DB with the given status.
 * Skips API/Stripe flow -- used for setting up test prerequisites quickly.
 */
export async function insertCommitment(
  userId: string,
  overrides: Partial<typeof commitments.$inferInsert> = {},
) {
  const now = new Date();
  const [row] = await db
    .insert(commitments)
    .values({
      userId,
      type: "walk",
      frequency: "three_times_a_week",
      duration: "one_weeks",
      sessionGoal: "steps",
      stakeAmount: 5000,
      lockedBonusAmount: 0,
      status: "pending_payment",
      startDate: now,
      endDate: addTime(now, DURATION_WEEKS.one_weeks, "WEEK"),
      gracePeriodEndsAt: addTime(now, 1, "DAY"),
      ...overrides,
    })
    .returning();

  return row!;
}

/**
 * Insert an active commitment with a matching stake transaction.
 * This is the common prerequisite for session/payment tests.
 */
export async function insertActiveCommitment(userId: string) {
  const commitment = await insertCommitment(userId, { status: "active" });

  await db.insert(transactions).values({
    userId,
    commitmentId: commitment.id,
    transactionType: "stake",
    status: "succeeded",
    stripeTransactionId: `pi_test_${commitment.id.slice(0, 8)}`,
    stripeCustomerId: `cus_test_${userId.slice(0, 8)}`,
    amount: commitment.stakeAmount,
  });

  return commitment;
}

/**
 * Insert an expired active commitment (endDate in past) with insufficient verified sessions.
 * Adds stake to pool so forfeit can be processed. Used for cron forfeit tests.
 */
export async function insertExpiredActiveCommitment(
  userId: string,
  options?: { verifiedSessionsCount?: number; stakeAmount?: number },
) {
  const now = new Date();
  const pastEndDate = new Date(now.getTime() - 24 * 60 * 60 * 1000); // 1 day ago
  const pastStartDate = new Date(pastEndDate.getTime() - 7 * 24 * 60 * 60 * 1000); // 1 week before end

  const [commitment] = await db
    .insert(commitments)
    .values({
      userId,
      type: "walk",
      frequency: "three_times_a_week",
      duration: "one_weeks",
      sessionGoal: "steps",
      stakeAmount: options?.stakeAmount ?? 5000,
      lockedBonusAmount: 0,
      status: "active",
      startDate: pastStartDate,
      endDate: pastEndDate,
      gracePeriodEndsAt: addTime(pastStartDate, 1, "DAY"),
    })
    .returning();

  if (!commitment) throw new Error("Failed to insert expired commitment");

  const stripeCustomerId = `cus_test_${userId.slice(0, 8)}`;
  await db.insert(transactions).values({
    userId,
    commitmentId: commitment.id,
    transactionType: "stake",
    status: "succeeded",
    stripeTransactionId: `pi_test_${commitment.id.slice(0, 8)}`,
    stripeCustomerId,
    amount: commitment.stakeAmount,
  });

  await poolService.addStake(commitment.stakeAmount);

  const verifiedCount = options?.verifiedSessionsCount ?? 0;
  for (let i = 0; i < verifiedCount; i++) {
    const day = new Date(pastStartDate);
    day.setDate(day.getDate() + i);
    const countingDay = day.toISOString().split("T")[0]!;
    await db.insert(commitmentSessions).values({
      userId,
      commitmentId: commitment.id,
      timezone: "America/Los_Angeles",
      countingDay,
      sessionGoal: "steps",
      sessionStatus: "completed",
      verificationStatus: "succeeded",
    });
  }

  return commitment;
}

/**
 * Insert an in-progress session for the given commitment.
 */
export async function insertInProgressSession(
  commitmentId: string,
  userId: string,
  countingDay?: string,
) {
  const [row] = await db
    .insert(commitmentSessions)
    .values({
      userId,
      commitmentId,
      timezone: "America/Los_Angeles",
      countingDay: countingDay ?? new Date().toISOString().split("T")[0]!,
      sessionGoal: "steps",
      sessionStatus: "in_progress",
    })
    .returning();

  return row!;
}

/**
 * Insert a completed session with movement data that passes the verification pipeline.
 * Used for testing verifySessionJob. Commitment must exist and be active.
 */
export async function insertCompletedSessionWithSamples(
  commitmentId: string,
  userId: string,
  countingDay: string,
  movementData: { motionSamples: unknown[]; gpsSamples: unknown[]; pedometerSamples: unknown[] },
) {
  const startDate = new Date(`${countingDay}T08:00:00-08:00`);
  const endDate = new Date(`${countingDay}T08:02:00-08:00`);

  const [session] = await db
    .insert(commitmentSessions)
    .values({
      userId,
      commitmentId,
      timezone: "America/Los_Angeles",
      countingDay,
      startDate,
      endDate,
      completedAt: endDate,
      sessionGoal: "steps",
      sessionStatus: "completed",
      verificationStatus: "pending",
    })
    .returning();

  if (!session) throw new Error("Failed to insert session");

  await sessionSampleService.ingestSamples(
    session.id,
    movementData.motionSamples as Parameters<typeof sessionSampleService.ingestSamples>[1],
    movementData.gpsSamples as Parameters<typeof sessionSampleService.ingestSamples>[2],
    movementData.pedometerSamples as Parameters<typeof sessionSampleService.ingestSamples>[3],
  );

  const [updated] = await db
    .select()
    .from(commitmentSessions)
    .where(eq(commitmentSessions.id, session.id));

  return updated!;
}

/**
 * Delete a commitment and all cascading data.
 */
export async function deleteCommitment(commitmentId: string) {
  await db.delete(commitments).where(eq(commitments.id, commitmentId));
}

/**
 * Close the DB connection. Call in the last afterAll.
 */
export async function closeDb() {
  await dbConnection.end();
}
