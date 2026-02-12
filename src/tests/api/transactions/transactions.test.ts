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

describe("GET /api/v1/transactions", () => {
  it("returns an array of transactions", async () => {
    const res = await auth.get("/api/v1/transactions").expect(200);

    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});

describe("GET /api/v1/transactions/:id", () => {
  it("returns 404 for non-existent transaction", async () => {
    const res = await auth.get("/api/v1/transactions/00000000-0000-0000-0000-000000000000");

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});

// ─── Error Cases ──────────────────────────────────────────────────────

describe("Transactions - Error Cases", () => {
  it("GET / without auth returns 401", async () => {
    const res = await getUnauthenticatedRequest().get("/api/v1/transactions");

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it("GET /:id with invalid UUID returns 422", async () => {
    const res = await auth.get("/api/v1/transactions/not-a-uuid");

    expect(res.status).toBe(422);
  });
});
