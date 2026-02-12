import supertest from "supertest";
import app from "@/app";
import { describe, it, expect, afterAll } from "vitest";
import { config } from "@/infra/config/config";
import { closeDb } from "@/tests/helpers/db";
import { getUnauthenticatedRequest } from "@/tests/helpers/auth";

const request = supertest(app);

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
