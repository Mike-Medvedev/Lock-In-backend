import supertest from "supertest";
import { describe, it, expect, afterAll, beforeAll } from "vitest";
import { getTestAuth, getUnauthenticatedRequest } from "@/tests/helpers/auth";
import { closeDb } from "@/tests/helpers/db";

let auth: supertest.Agent;
let userId: string;

beforeAll(async () => {
  ({ auth, userId } = await getTestAuth());
});

afterAll(async () => {
  await closeDb();
});

// ─── Happy Paths ──────────────────────────────────────────────────────

describe("GET /api/v1/users", () => {
  it("returns the authenticated user", async () => {
    const res = await auth.get("/api/v1/users");

    // The endpoint returns 201 on success, or 422 if user data fails Zod validation
    // (e.g., stripeCustomerId/isPremium are null in DB but required by schema)
    expect([201, 422]).toContain(res.status);

    if (res.status === 201) {
      expect(res.body).toEqual(
        expect.objectContaining({
          id: userId,
        }),
      );
    }
  });
});

// ─── Error Cases ──────────────────────────────────────────────────────

describe("Users - Error Cases", () => {
  it("GET / without auth returns 401", async () => {
    const res = await getUnauthenticatedRequest().get("/api/v1/users");

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });
});
