import supertest from "supertest";
import { describe, it, expect, afterAll, beforeAll } from "vitest";
import { getTestAuth, getUnauthenticatedRequest } from "@/tests/helpers/auth";
import { closeDb } from "@/tests/helpers/db";

let auth: supertest.Agent;

beforeAll(async () => {
  ({ auth } = await getTestAuth());
});

afterAll(async () => {
  await closeDb();
});

// ─── Happy Paths ──────────────────────────────────────────────────────

describe("GET /api/v1/pool", () => {
  it("returns the pool state", async () => {
    const res = await auth.get("/api/v1/pool").expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        stakesHeld: expect.any(Number),
        balance: expect.any(Number),
        totalRakeCollected: expect.any(Number),
      }),
    );
  });
});

// ─── Error Cases ──────────────────────────────────────────────────────

describe("Pool - Error Cases", () => {
  it("GET / without auth returns 401", async () => {
    const res = await getUnauthenticatedRequest().get("/api/v1/pool");

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });
});
