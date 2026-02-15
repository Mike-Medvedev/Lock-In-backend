import supertest from "supertest";
import app from "@/app";
import { describe, it, expect, afterAll, beforeAll } from "vitest";
import { config } from "@/infra/config/config";
import { closeDb, insertExpiredActiveCommitment, deleteCommitment } from "@/tests/helpers/db";
import { getTestAuth, getUnauthenticatedRequest } from "@/tests/helpers/auth";
import { poolService } from "@/features/pool/pool.service";
import { db } from "@/infra/db/db";
import { commitments, transactions } from "@/infra/db/schema";
import { eq, and } from "drizzle-orm";
import { RAKE } from "@/shared/constants";

const request = supertest(app);

let userId: string;

beforeAll(async () => {
  const auth = await getTestAuth();
  userId = auth.userId;
});

afterAll(async () => {
  await closeDb();
});

// ─── Happy Paths ──────────────────────────────────────────────────────

describe("POST /cron/forfeit-expired", () => {
  it("returns forfeited commitments with valid CRON_SECRET", async () => {
    const res = await request
      .post("/cron/forfeit-expired")
      .set("Authorization", `Bearer ${config.CRON_SECRET}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual(
      expect.objectContaining({
        forfeitedCount: expect.any(Number),
        commitments: expect.any(Array),
      }),
    );
  });

  it("forfeits expired commitments with insufficient sessions, adds forfeiture to pool, and rakes per RAKE constant", async () => {
    const stakeAmountCents = 1000; // $10.00 — easy to verify rake math
    const commitment1 = await insertExpiredActiveCommitment(userId, {
      verifiedSessionsCount: 1,
      stakeAmount: stakeAmountCents,
    });
    const commitment2 = await insertExpiredActiveCommitment(userId, {
      verifiedSessionsCount: 0,
      stakeAmount: stakeAmountCents,
    });

    const poolBefore = await poolService.get();
    const expectedRakePerCommitment = Math.round(stakeAmountCents * RAKE.RATE);
    const expectedPoolPerCommitment = stakeAmountCents - expectedRakePerCommitment;

    const res = await request
      .post("/cron/forfeit-expired")
      .set("Authorization", `Bearer ${config.CRON_SECRET}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.forfeitedCount).toBe(2);
    expect(res.body.data.commitments).toHaveLength(2);

    const forfeitedIds = res.body.data.commitments.map(
      (c: { commitmentId: string }) => c.commitmentId,
    );
    expect(forfeitedIds).toContain(commitment1.id);
    expect(forfeitedIds).toContain(commitment2.id);

    const poolAfter = await poolService.get();

    const totalStakeDollars = (stakeAmountCents * 2) / 100;
    const totalRakeDollars = (expectedRakePerCommitment * 2) / 100;
    const totalPoolDollars = (expectedPoolPerCommitment * 2) / 100;

    expect(poolAfter.stakesHeld).toBeCloseTo(poolBefore.stakesHeld - totalStakeDollars, 2);
    expect(poolAfter.balance).toBeCloseTo(poolBefore.balance + totalPoolDollars, 2);
    expect(poolAfter.totalRakeCollected).toBeCloseTo(
      poolBefore.totalRakeCollected + totalRakeDollars,
      2,
    );

    const [c1] = await db
      .select({ status: commitments.status })
      .from(commitments)
      .where(eq(commitments.id, commitment1.id));
    const [c2] = await db
      .select({ status: commitments.status })
      .from(commitments)
      .where(eq(commitments.id, commitment2.id));
    expect(c1?.status).toBe("forfeited");
    expect(c2?.status).toBe("forfeited");

    const forfeitTxs = await db
      .select()
      .from(transactions)
      .where(
        and(
          eq(transactions.transactionType, "forfeit"),
          eq(transactions.commitmentId, commitment1.id),
        ),
      );
    const rakeTxs = await db
      .select()
      .from(transactions)
      .where(
        and(
          eq(transactions.transactionType, "rake"),
          eq(transactions.commitmentId, commitment1.id),
        ),
      );

    expect(forfeitTxs).toHaveLength(1);
    expect(forfeitTxs[0]!.amount).toBe(stakeAmountCents);
    expect(forfeitTxs[0]!.status).toBe("succeeded");
    expect(rakeTxs).toHaveLength(1);
    expect(rakeTxs[0]!.amount).toBe(expectedRakePerCommitment);
    expect(rakeTxs[0]!.status).toBe("succeeded");

    await deleteCommitment(commitment1.id);
    await deleteCommitment(commitment2.id);
  }, 15_000);
});

// ─── Error Cases ──────────────────────────────────────────────────────

describe("Cron - Error Cases", () => {
  it("POST / without auth returns 401", async () => {
    const res = await getUnauthenticatedRequest().post("/cron/forfeit-expired");

    expect(res.status).toBe(401);
  });

  it("POST / with wrong secret returns 401", async () => {
    const res = await request
      .post("/cron/forfeit-expired")
      .set("Authorization", "Bearer wrong_secret_value");

    expect(res.status).toBe(401);
  });
});
