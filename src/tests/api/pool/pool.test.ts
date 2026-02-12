import supertest from "supertest";
import { describe, it, expect, afterAll, beforeAll } from "vitest";
import { getTestAuth, getUnauthenticatedRequest } from "@/tests/helpers/auth";
import { closeDb } from "@/tests/helpers/db";
import { poolService } from "@/features/pool/pool.service";
import { RAKE } from "@/shared/constants";

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

// ─── Rake Logic ───────────────────────────────────────────────────────

describe("Pool rake on forfeit", () => {
  it("takes 20% rake and puts 80% into pool balance", async () => {
    const forfeitCents = 1000; // $10.00
    const expectedRake = Math.round(forfeitCents * RAKE.RATE); // 200
    const expectedPool = forfeitCents - expectedRake; // 800

    const result = await poolService.addForfeit(forfeitCents);

    expect(result).toEqual({
      totalCents: forfeitCents,
      rakeCents: expectedRake,
      poolCents: expectedPool,
    });
  });

  it("correctly splits the minimum stake (50 cents)", async () => {
    const result = await poolService.addForfeit(50);

    expect(result).toEqual({
      totalCents: 50,
      rakeCents: 10,
      poolCents: 40,
    });
  });

  it("rounds rake correctly on odd amounts", async () => {
    // 333 cents × 0.20 = 66.6 → rounds to 67
    const result = await poolService.addForfeit(333);

    expect(result.rakeCents).toBe(67);
    expect(result.poolCents).toBe(266);
    expect(result.rakeCents + result.poolCents).toBe(333);
  });

  it("updates pool balance and totalRakeCollected in DB", async () => {
    const before = await poolService.get();

    const forfeitCents = 500; // $5.00
    const { rakeCents, poolCents } = await poolService.addForfeit(forfeitCents);

    const after = await poolService.get();

    const balanceDelta = after.balance - before.balance;
    const rakeDelta = after.totalRakeCollected - before.totalRakeCollected;

    expect(balanceDelta).toBeCloseTo(poolCents / 100, 2);
    expect(rakeDelta).toBeCloseTo(rakeCents / 100, 2);
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
