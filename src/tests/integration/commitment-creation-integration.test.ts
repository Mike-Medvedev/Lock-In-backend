import supertest from "supertest";
import app from "@/app";
import { describe, it, expect, afterAll, beforeAll } from "vitest";
import { verificationWorker } from "@/infra/queue/workers";
import { verificationQueue } from "@/infra/queue/queue";
import { client as dbConnection, db } from "@/infra/db/db.ts";
import { supabase } from "@/infra/auth/auth";
import { config } from "@/infra/config/config";
import { payloads, expected } from "./fixtures/commitments.fixtures";
import { webhookService } from "@/features/webhooks/webhooks.service";
import { commitmentSessions, transactions } from "@/infra/db/schema";
import { eq, and } from "drizzle-orm";

const request = supertest;
let auth: supertest.Agent;
let userId: string;

beforeAll(async () => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: config.TEST_USER_EMAIL,
    password: config.TEST_USER_PASSWORD,
  });

  if (error || !data.session || !data.user) {
    throw new Error(`Test auth failed: ${error?.message ?? "no session"}`);
  }

  userId = data.user.id;
  auth = supertest.agent(app).set("Authorization", `Bearer ${data.session.access_token}`);
});

describe("misc", () => {
  it("returns hello world", async () => {
    const res = await request(app).get("/");
    expect(res.text).toBe("Hello World");
  });

  it("returns 200 on health check", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
  });
});

// ─── E2E: Commitment Lifecycle ───────────────────────────────────────

/**
 * Full commitment lifecycle:
 *  1. Create commitment
 *  2. Create & confirm payment
 *  3. Create a session
 *  4. Submit movement data
 *  6. Submit to verification pipeline
 *  7. Receive & verify verification result
 *  8. Repeat for 3 sessions
 *  9. Verify Successfully Completed Commitment
 */
describe("e2e", () => {
  let commitmentId: string;
  let paymentIntentId: string;
  let commitmentSessionIds: string[];

  it("creates a commitment", async () => {
    const res = await auth.post("/api/v1/commitments").send(payloads.commitment);

    commitmentId = res.body.data.id;
    expect(res.body).toEqual(expected.commitment);
  });

  it("creates payment", async () => {
    const res = await auth.post("/api/v1/payments").send(payloads.payment(commitmentId));

    paymentIntentId = res.body.data.paymentIntentId;
    expect(res.body).toEqual(expected.payment);
  });

  it("confirms payment", async () => {
    const res = await auth.post("/api/v1/payments/confirm").send({ paymentIntentId });

    expect(res.body).toEqual(expected.paymentConfirmed);
  });

  it("runs stripe webhook payment confirmation event procedure", async () => {
    const paymentAmount = expected.commitment.data.stakeAmount;
    await webhookService.handlePaymentConfirmation(paymentIntentId, paymentAmount, commitmentId);
  });

  const sessionDates = ["2026-02-09", "2026-02-11", "2026-02-13"];

  it("creates 3 commitment sessions", async () => {
    const sessions = await db
      .insert(commitmentSessions)
      .values(payloads.sessions(commitmentId, userId))
      .returning();

    expect(sessions).toHaveLength(3);
    for (let i = 0; i < sessions.length; i++) {
      expect(sessions[i]).toEqual(expected.insertedSession(commitmentId, userId, sessionDates[i]!));
    }
    commitmentSessionIds = sessions.map((s) => s.id);
  });

  it("submits movement data to all 3 commitment sessions", async () => {
    for (let i = 0; i < commitmentSessionIds.length; i++) {
      const res = await auth
        .post(`/api/v1/commitment-sessions/${commitmentSessionIds[i]}/samples`)
        .send(payloads.movementDataForSession(sessionDates[i]!));

      expect(res.body).toEqual(expected.movementData);
    }
  });

  it("completes all 3 sessions", async () => {
    for (const sessionId of commitmentSessionIds) {
      const res = await auth.post(`/api/v1/commitment-sessions/${sessionId}/complete`);

      expect(res.body).toEqual(expected.completedSession(sessionId, commitmentId));
    }
  });

  it("verifies all 3 sessions, completes commitment, and refunds stake", async () => {
    // Collect exactly 3 distinct completed jobs before proceeding.
    // Ignore "failed" events after all 3 complete (duplicate completion race).
    const resultsPromise = new Promise<unknown[]>((resolve, reject) => {
      const results: unknown[] = [];
      let settled = false;
      const timeout = setTimeout(() => {
        if (!settled) reject(new Error("Verification jobs timed out"));
      }, 15_000);

      verificationWorker.on("completed", (job) => {
        results.push(job.returnvalue);
        if (results.length === 3 && !settled) {
          settled = true;
          clearTimeout(timeout);
          resolve(results);
        }
      });

      verificationWorker.on("failed", (_, err) => {
        if (!settled) {
          settled = true;
          clearTimeout(timeout);
          reject(new Error(`Verification job failed: ${err.message}`));
        }
      });
    });

    // Submit all 3 to verification
    for (const sessionId of commitmentSessionIds) {
      const res = await auth.post(`/api/v1/commitment-sessions/${sessionId}/verify`);
      expect(res.body).toEqual(expected.verificationSubmitted);
    }

    // Wait for all 3 jobs to complete (including the last one's payout + completion)
    const results = await resultsPromise;

    expect(results).toHaveLength(3);
    for (const result of results) {
      expect(result).toEqual(
        expect.objectContaining({
          id: expect.any(String),
          verificationStatus: expect.toBeOneOf(["succeeded", "failed"]),
        }),
      );
    }

    // By now the worker has finished: commitment completed + payout issued
    // Assert commitment status
    const commitmentRes = await auth.get(`/api/v1/commitments/${commitmentId}`);
    expect(commitmentRes.body.data.status).toBe("completed");

    // Assert payout transaction was created
    const [payoutTx] = await db
      .select()
      .from(transactions)
      .where(
        and(
          eq(transactions.commitmentId, commitmentId),
          eq(transactions.transactionType, "payout"),
        ),
      );
    expect(payoutTx).toBeDefined();
    expect(payoutTx!.status).toBe("pending");
    expect(payoutTx!.amount).toBe(payloads.commitment.stakeAmount);
  }, 20_000);

  afterAll(async () => {
    await auth.delete(`/api/v1/commitments/${commitmentId}`);

    await verificationWorker.close();
    await verificationQueue.close();
    await dbConnection.end();
  });
});
