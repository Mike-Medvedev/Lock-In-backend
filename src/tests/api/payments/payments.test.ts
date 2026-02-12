import supertest from "supertest";
import { describe, it, expect, afterAll, beforeAll, afterEach } from "vitest";
import { getTestAuth, getUnauthenticatedRequest } from "@/tests/helpers/auth";
import { insertCommitment, deleteCommitment, closeDb } from "@/tests/helpers/db";
import { payloads, expected } from "./payments.fixtures";

let auth: supertest.Agent;
let userId: string;
const createdCommitmentIds: string[] = [];

beforeAll(async () => {
  ({ auth, userId } = await getTestAuth());
});

afterEach(async () => {
  for (const id of createdCommitmentIds) {
    await deleteCommitment(id).catch(() => {});
  }
  createdCommitmentIds.length = 0;
});

afterAll(async () => {
  await closeDb();
});

// ─── Happy Paths ──────────────────────────────────────────────────────

describe("POST /api/v1/payments", () => {
  it("creates a PaymentIntent for a pending_payment commitment", async () => {
    const commitment = await insertCommitment(userId);
    createdCommitmentIds.push(commitment.id);

    const res = await auth
      .post("/api/v1/payments")
      .send(payloads.payment(commitment.id))
      .expect(200);

    expect(res.body).toEqual(expected.payment);
  });
});

describe("POST /api/v1/payments/confirm", () => {
  it("confirms a PaymentIntent", async () => {
    const commitment = await insertCommitment(userId);
    createdCommitmentIds.push(commitment.id);

    // Create the PaymentIntent first
    const createRes = await auth.post("/api/v1/payments").send(payloads.payment(commitment.id));
    const { paymentIntentId } = createRes.body.data;

    const res = await auth.post("/api/v1/payments/confirm").send({ paymentIntentId }).expect(200);

    expect(res.body).toEqual(expected.paymentConfirmed);
  });
});

// ─── Error Cases ──────────────────────────────────────────────────────

describe("Payments - Error Cases", () => {
  it("POST / on already staked commitment returns 409", async () => {
    const commitment = await insertCommitment(userId, { status: "active" });
    createdCommitmentIds.push(commitment.id);

    const res = await auth.post("/api/v1/payments").send(payloads.payment(commitment.id));

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
  });

  it("POST /confirm with invalid paymentIntentId returns 400", async () => {
    const res = await auth
      .post("/api/v1/payments/confirm")
      .send({ paymentIntentId: "pi_invalid_fake_id" });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it("POST / without auth returns 401", async () => {
    const res = await getUnauthenticatedRequest()
      .post("/api/v1/payments")
      .send(payloads.payment("00000000-0000-0000-0000-000000000000"));

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });
});
