import { db, client as dbConnection } from "@/infra/db/db";
import { commitments, commitmentSessions, transactions } from "@/infra/db/schema";
import { eq } from "drizzle-orm";
import { addTime } from "@/shared/date";
import { DURATION_WEEKS } from "@/shared/constants";

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
