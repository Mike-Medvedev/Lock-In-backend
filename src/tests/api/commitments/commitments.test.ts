import supertest from "supertest";
import { describe, it, expect, afterAll, beforeAll, afterEach } from "vitest";
import { getTestAuth, getUnauthenticatedRequest } from "@/tests/helpers/auth";
import { insertCommitment, deleteCommitment, closeDb } from "@/tests/helpers/db";
import { db } from "@/infra/db/db";
import { commitments } from "@/infra/db/schema";
import { eq } from "drizzle-orm";
import { payloads, expected } from "./commitments.fixtures";

let auth: supertest.Agent;
let userId: string;
const createdIds: string[] = [];

beforeAll(async () => {
  ({ auth, userId } = await getTestAuth());
  // Clean up any leftover active commitments from other test runs
  await db.delete(commitments).where(eq(commitments.userId, userId));
});

afterEach(async () => {
  for (const id of createdIds) {
    await deleteCommitment(id).catch(() => {});
  }
  createdIds.length = 0;
});

afterAll(async () => {
  await closeDb();
});

// ─── Happy Paths ──────────────────────────────────────────────────────

describe("POST /api/v1/commitments", () => {
  it("creates a commitment with status pending_payment", async () => {
    const res = await auth.post("/api/v1/commitments").send(payloads.validCommitment).expect(201);

    createdIds.push(res.body.data.id);
    expect(res.body).toEqual(expected.commitment);
  });
});

describe("GET /api/v1/commitments", () => {
  it("lists commitments for the authenticated user", async () => {
    const commitment = await insertCommitment(userId);
    createdIds.push(commitment.id);

    const res = await auth.get("/api/v1/commitments").expect(200);

    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
  });
});

describe("GET /api/v1/commitments/active", () => {
  it("lists only active commitments", async () => {
    const commitment = await insertCommitment(userId, { status: "active" });
    createdIds.push(commitment.id);

    const res = await auth.get("/api/v1/commitments/active").expect(200);

    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    for (const c of res.body.data) {
      expect(c.status).toBe("active");
    }
  });
});

describe("GET /api/v1/commitments/:id", () => {
  it("returns a single commitment by ID", async () => {
    const commitment = await insertCommitment(userId);
    createdIds.push(commitment.id);

    const res = await auth.get(`/api/v1/commitments/${commitment.id}`).expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(commitment.id);
    expect(res.body.data).toEqual(expect.objectContaining(expected.commitmentShape));
  });
});

describe("PATCH /api/v1/commitments/:id", () => {
  it("updates a commitment", async () => {
    const commitment = await insertCommitment(userId);
    createdIds.push(commitment.id);

    const res = await auth
      .patch(`/api/v1/commitments/${commitment.id}`)
      .send({ status: "cancelled" })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe("cancelled");
  });
});

describe("GET /api/v1/commitments/:id/cancel", () => {
  it("returns a cancel preview for a pending_payment commitment", async () => {
    const commitment = await insertCommitment(userId);
    createdIds.push(commitment.id);

    const res = await auth.get(`/api/v1/commitments/${commitment.id}/cancel`).expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual(
      expect.objectContaining({
        id: commitment.id,
        cancellable: true,
      }),
    );
  });
});

describe("POST /api/v1/commitments/:id/cancel", () => {
  it("cancels a pending_payment commitment", async () => {
    const commitment = await insertCommitment(userId);
    createdIds.push(commitment.id);

    const res = await auth.post(`/api/v1/commitments/${commitment.id}/cancel`).expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe("cancelled");
    expect(res.body.data.refunded).toBe(false);
  });
});

describe("DELETE /api/v1/commitments/:id", () => {
  it("deletes a commitment and returns 204", async () => {
    const commitment = await insertCommitment(userId);

    await auth.delete(`/api/v1/commitments/${commitment.id}`).expect(204);
  });
});

// ─── Error Cases ──────────────────────────────────────────────────────

describe("Commitments - Error Cases", () => {
  it("POST / without auth returns 401", async () => {
    const res = await getUnauthenticatedRequest()
      .post("/api/v1/commitments")
      .send(payloads.validCommitment);

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it("GET /:id with invalid UUID returns 422", async () => {
    const res = await auth.get("/api/v1/commitments/not-a-uuid");

    expect(res.status).toBe(422);
  });

  it("GET /:id with non-existent ID returns 404", async () => {
    const res = await auth.get("/api/v1/commitments/00000000-0000-0000-0000-000000000000");

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it("POST / with missing required fields returns 422", async () => {
    const res = await auth.post("/api/v1/commitments").send(payloads.missingFields);

    expect(res.status).toBe(422);
  });

  it("POST / when user already has active commitment returns 409", async () => {
    const commitment = await insertCommitment(userId, { status: "active" });
    createdIds.push(commitment.id);

    const res = await auth.post("/api/v1/commitments").send(payloads.validCommitment);

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
  });

  it("POST / with stakeAmount below minimum returns error", async () => {
    const res = await auth.post("/api/v1/commitments").send(payloads.invalidStakeAmount);

    // May hit check constraint (400/500) or validation error (422)
    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});
