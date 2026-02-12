import supertest from "supertest";
import app from "@/app";
import { describe, it, expect, afterAll, beforeAll } from "vitest";
import { verificationWorker } from "@/infra/queue/workers";
import { verificationQueue } from "@/infra/queue/queue";
import { client as db } from "@/infra/db/db.ts";
import { supabase } from "@/infra/auth/auth";
import { config } from "@/infra/config/config";
import { payloads, expected } from "./fixtures/commitments.fixtures";
import { webhookService } from "@/features/webhooks/webhooks.service";

const request = supertest;
let auth: supertest.Agent;

beforeAll(async () => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: config.TEST_USER_EMAIL,
    password: config.TEST_USER_PASSWORD,
  });

  if (error || !data.session) {
    throw new Error(`Test auth failed: ${error?.message ?? "no session"}`);
  }

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
 *  3. Create session
 *  4. Submit movement data
 *  5. Complete session
 *  6. Submit to verification pipeline
 *  7. Receive verification result
 */
describe("e2e", () => {
  let commitmentId: string;
  let paymentIntentId: string;
  let commitmentSessionId: string;

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

  it("creates commitment session", async () => {
    const res = await auth.post("/api/v1/commitment-sessions").send(payloads.session(commitmentId));

    commitmentSessionId = res.body.data.id;
    expect(res.body).toEqual(expected.session(commitmentId));
  });

  it("submits movement data", async () => {
    const res = await auth
      .post(`/api/v1/commitment-sessions/${commitmentSessionId}/samples`)
      .send(payloads.movementData);

    expect(res.body).toEqual(expected.movementData);
  });

  it("completes session", async () => {
    const res = await auth.post(`/api/v1/commitment-sessions/${commitmentSessionId}/complete`);

    expect(res.body).toEqual(expected.completedSession(commitmentSessionId, commitmentId));
  });

  it("submits session to verification pipeline", async () => {
    const res = await auth.post(`/api/v1/commitment-sessions/${commitmentSessionId}/verify`);

    expect(res.body).toEqual(expected.verificationSubmitted);
  });

  it("returns verification result", async () => {
    const result = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Verification job timed out")), 10_000);

      verificationWorker.on("completed", (job) => {
        clearTimeout(timeout);
        resolve(job.returnvalue);
      });

      verificationWorker.on("failed", (_, err) => {
        clearTimeout(timeout);
        reject(new Error(`Verification job failed: ${err.message}`));
      });
    });

    expect(result).toEqual(
      expect.objectContaining({
        id: commitmentSessionId,
        verificationStatus: expect.any(String),
      }),
    );
  });

  afterAll(async () => {
    await auth.delete(`/api/v1/commitments/${commitmentId}`);

    await verificationWorker.close();
    await verificationQueue.close();
    await db.end();
  });
});
