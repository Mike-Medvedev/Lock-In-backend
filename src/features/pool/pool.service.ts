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
   * Record a stake we're holding (money owed back to user if they complete or get refunded).
   * Updates stakes_held only; does not add to available balance.
   */
  async addStake(amountCents: number): Promise<void> {
    const amountDollars = amountCents / 100;
    const [existing] = await this._db.select({ id: pool.id }).from(pool).limit(1);
    if (existing) {
      await this._db
        .update(pool)
        .set({
          stakesHeld: sql`${pool.stakesHeld} + ${amountDollars}`,
          updatedAt: new Date(),
        })
        .where(eq(pool.id, existing.id));
    } else {
      await this._db.insert(pool).values({
        stakesHeld: amountDollars,
        updatedAt: new Date(),
      });
    }
  }

  /**
   * Subtract a refunded amount from stakes we're holding (we no longer owe it).
   */
  async subtractRefund(amountCents: number): Promise<void> {
    const amountDollars = amountCents / 100;
    const [existing] = await this._db.select({ id: pool.id }).from(pool).limit(1);
    if (!existing) return;
    await this._db
      .update(pool)
      .set({
        stakesHeld: sql`GREATEST(0, ${pool.stakesHeld} - ${amountDollars})`,
        updatedAt: new Date(),
      })
      .where(eq(pool.id, existing.id));
  }

  /**
   * Move a forfeited stake from "held" to actual pool balance (available for bonuses).
   */
  async addForfeit(amountCents: number): Promise<void> {
    const amountDollars = amountCents / 100;
    const [existing] = await this._db.select({ id: pool.id }).from(pool).limit(1);
    if (existing) {
      await this._db
        .update(pool)
        .set({
          stakesHeld: sql`GREATEST(0, ${pool.stakesHeld} - ${amountDollars})`,
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

  /**
   * Subtract a payout from stakesHeld when a user completes their commitment
   * and we return their stake (or stake + bonus).
   *
   * TODO: When bonuses are implemented, also subtract bonus from `balance`.
   */
  async subtractPayout(stakeAmountCents: number, _bonusAmountCents: number = 0): Promise<void> {
    const stakeDollars = stakeAmountCents / 100;
    // const bonusDollars = bonusAmountCents / 100; // TODO: use when bonuses are live
    const [existing] = await this._db.select({ id: pool.id }).from(pool).limit(1);
    if (!existing) return;

    await this._db
      .update(pool)
      .set({
        stakesHeld: sql`GREATEST(0, ${pool.stakesHeld} - ${stakeDollars})`,
        // TODO: When bonuses are live, also subtract from balance:
        // balance: sql`GREATEST(0, ${pool.balance} - ${bonusDollars})`,
        updatedAt: new Date(),
      })
      .where(eq(pool.id, existing.id));
  }
}

export const poolService = new PoolService(db);
