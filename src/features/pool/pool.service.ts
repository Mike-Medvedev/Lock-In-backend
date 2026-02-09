import { db, type DB } from "@/infra/db/db.ts";
import { pool } from "@/infra/db/schema";
import { eq, sql } from "drizzle-orm";
import type { z } from "zod";
import { PoolModel } from "./pool.model";
import { DatabaseResourceNotFoundError } from "@/shared/errors";

class PoolService {
  constructor(private readonly _db: DB) {}

  async get(): Promise<z.infer<typeof PoolModel>> {
    const [row] = await this._db.select().from(pool).limit(1);
    if (!row) throw new DatabaseResourceNotFoundError();
    return row as z.infer<typeof PoolModel>;
  }

  /**
   * Add a successful stake to the pool. Amount is in cents; pool balance is stored in dollars.
   * Updates the first pool row (singleton pool). Creates the pool row if none exists.
   */
  async addStake(amountCents: number): Promise<void> {
    const amountDollars = amountCents / 100;
    const [existing] = await this._db.select({ id: pool.id }).from(pool).limit(1);
    if (existing) {
      await this._db
        .update(pool)
        .set({
          balance: sql`${pool.balance} + ${amountDollars}`,
          updatedAt: new Date(),
        })
        .where(eq(pool.id, existing.id));
    } else {
      await this._db.insert(pool).values({
        balance: amountDollars,
        updatedAt: new Date(),
      });
    }
  }
}

export const poolService = new PoolService(db);
