import supertest from "supertest";
import { describe, it, expect, afterAll, beforeAll, beforeEach, afterEach } from "vitest";
import { getTestAuth, getUnauthenticatedRequest } from "@/tests/helpers/auth";
import {
  insertActiveCommitment,
  insertInProgressSession,
  deleteCommitment,
  closeDb,
} from "@/tests/helpers/db";
import { db } from "@/infra/db/db";
import { commitments } from "@/infra/db/schema";
import { eq } from "drizzle-orm";
import { payloads, expected } from "./commitment-sessions.fixtures";

let auth: supertest.Agent;
let userId: string;
let commitmentId: string;
const createdCommitmentIds: string[] = [];

beforeAll(async () => {
  ({ auth, userId } = await getTestAuth());
  // Clean up any leftover commitments from other test runs
  await db.delete(commitments).where(eq(commitments.userId, userId));
});

beforeEach(async () => {
  const commitment = await insertActiveCommitment(userId);
  commitmentId = commitment.id;
  createdCommitmentIds.push(commitment.id);
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

describe("POST /api/v1/commitment-sessions", () => {
  it("creates a session with status in_progress", async () => {
    const res = await auth
      .post("/api/v1/commitment-sessions")
      .send(payloads.session(commitmentId))
      .expect(201);

    expect(res.body.success).toBe(true);
    expect(res.body.data.sessionStatus).toBe("in_progress");
    expect(res.body.data.verificationStatus).toBe("not_started");
    expect(res.body.data.commitmentId).toBe(commitmentId);
    expect(res.body.data).toEqual(expect.objectContaining(expected.sessionShape));
  });
});

describe("GET /api/v1/commitment-sessions", () => {
  it("lists sessions for the authenticated user", async () => {
    await insertInProgressSession(commitmentId, userId);

    const res = await auth.get("/api/v1/commitment-sessions").expect(200);

    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
  });
});

describe("GET /api/v1/commitment-sessions/:id", () => {
  it("returns a single session by ID", async () => {
    const session = await insertInProgressSession(commitmentId, userId);

    const res = await auth.get(`/api/v1/commitment-sessions/${session.id}`).expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(session.id);
  });
});

describe("POST /api/v1/commitment-sessions/:id/pause", () => {
  it("pauses an in-progress session", async () => {
    const session = await insertInProgressSession(commitmentId, userId);

    const res = await auth.post(`/api/v1/commitment-sessions/${session.id}/pause`).expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.sessionStatus).toBe("paused");
  });
});

describe("POST /api/v1/commitment-sessions/:id/resume", () => {
  it("resumes a paused session", async () => {
    const session = await insertInProgressSession(commitmentId, userId);

    // First pause it
    await auth.post(`/api/v1/commitment-sessions/${session.id}/pause`);

    // Then resume
    const res = await auth.post(`/api/v1/commitment-sessions/${session.id}/resume`).expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.sessionStatus).toBe("in_progress");
  });
});

describe("POST /api/v1/commitment-sessions/:id/complete", () => {
  it("completes a session with verification pending", async () => {
    const session = await insertInProgressSession(commitmentId, userId);

    const res = await auth.post(`/api/v1/commitment-sessions/${session.id}/complete`).expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.sessionStatus).toBe("completed");
    expect(res.body.data.verificationStatus).toBe("pending");
    expect(res.body.data.endDate).toEqual(expect.any(String));
    expect(res.body.data.completedAt).toEqual(expect.any(String));
  });
});

describe("POST /api/v1/commitment-sessions/:id/cancel", () => {
  it("cancels an in-progress session", async () => {
    const session = await insertInProgressSession(commitmentId, userId);

    const res = await auth.post(`/api/v1/commitment-sessions/${session.id}/cancel`).expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.sessionStatus).toBe("cancelled");
  });
});

describe("POST /api/v1/commitment-sessions/:id/samples", () => {
  it("uploads movement data samples", async () => {
    const session = await insertInProgressSession(commitmentId, userId);

    const res = await auth
      .post(`/api/v1/commitment-sessions/${session.id}/samples`)
      .send(payloads.movementData)
      .expect(201);

    expect(res.body).toEqual(expected.movementData);
  });
});

describe("GET /api/v1/commitment-sessions/:id/samples", () => {
  it("returns uploaded samples for a session", async () => {
    const session = await insertInProgressSession(commitmentId, userId);

    // Upload samples first
    await auth
      .post(`/api/v1/commitment-sessions/${session.id}/samples`)
      .send(payloads.movementData);

    const res = await auth.get(`/api/v1/commitment-sessions/${session.id}/samples`).expect(200);

    expect(res.body).toEqual(expected.samplesShape);
    expect(res.body.data.motionSamples.length).toBe(1);
    expect(res.body.data.gpsSamples.length).toBe(1);
    expect(res.body.data.pedometerSamples.length).toBe(1);
  });
});

describe("POST /api/v1/commitment-sessions/:id/verify", () => {
  it("submits a completed session for verification", async () => {
    const session = await insertInProgressSession(commitmentId, userId);

    // Complete it first
    await auth.post(`/api/v1/commitment-sessions/${session.id}/complete`);

    const res = await auth.post(`/api/v1/commitment-sessions/${session.id}/verify`).expect(202);

    expect(res.body).toEqual(expected.verificationSubmitted);
  });
});

// ─── Error Cases ──────────────────────────────────────────────────────

describe("Commitment Sessions - Error Cases", () => {
  it("POST / without active commitment returns 400", async () => {
    // Create a pending_payment commitment (not active)
    const { insertCommitment } = await import("@/tests/helpers/db");
    const pending = await insertCommitment(userId, { status: "pending_payment" });
    createdCommitmentIds.push(pending.id);

    const res = await auth.post("/api/v1/commitment-sessions").send(payloads.session(pending.id));

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it("POST /:id/complete on already completed session returns 409", async () => {
    const session = await insertInProgressSession(commitmentId, userId);
    await auth.post(`/api/v1/commitment-sessions/${session.id}/complete`);

    const res = await auth.post(`/api/v1/commitment-sessions/${session.id}/complete`);

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
  });

  it("POST /:id/pause on completed session returns 409", async () => {
    const session = await insertInProgressSession(commitmentId, userId);
    await auth.post(`/api/v1/commitment-sessions/${session.id}/complete`);

    const res = await auth.post(`/api/v1/commitment-sessions/${session.id}/pause`);

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
  });

  it("POST /:id/resume on non-paused session returns 400", async () => {
    const session = await insertInProgressSession(commitmentId, userId);

    const res = await auth.post(`/api/v1/commitment-sessions/${session.id}/resume`);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it("POST /:id/verify on non-completed session returns 400", async () => {
    const session = await insertInProgressSession(commitmentId, userId);

    const res = await auth.post(`/api/v1/commitment-sessions/${session.id}/verify`);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it("POST / without auth returns 401", async () => {
    const res = await getUnauthenticatedRequest()
      .post("/api/v1/commitment-sessions")
      .send(payloads.session(commitmentId));

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });
});
