import { db, type DB } from "@/infra/db/db.ts";
import { pool } from "@/infra/db/schema";
import { eq, sql } from "drizzle-orm";
import type { z } from "zod";
import { PoolModel, type ForfeitBreakdown } from "./pool.model";
import { DatabaseResourceNotFoundError } from "@/shared/errors";
import { RAKE } from "@/shared/constants";
import logger from "@/infra/logger/logger";

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

    logger.info("Pool: Stake added to stakesHeld", { amountCents, amountDollars });
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

    logger.info("Pool: Refund subtracted from stakesHeld", { amountCents, amountDollars });
  }

  /**
   * Move a forfeited stake from "held" into rake + pool balance.
   *
   * Split:
   *   rake  = amountCents × RAKE.RATE  → totalRakeCollected (platform revenue)
   *   pool  = amountCents − rake        → balance (funds future bonuses)
   *
   * Returns the breakdown so callers can log / record it.
   */
  async addForfeit(amountCents: number): Promise<ForfeitBreakdown> {
    const rakeCents = Math.round(amountCents * RAKE.RATE);
    const poolCents = amountCents - rakeCents;

    const totalDollars = amountCents / 100;
    const rakeDollars = rakeCents / 100;
    const poolDollars = poolCents / 100;

    const [existing] = await this._db.select({ id: pool.id }).from(pool).limit(1);
    if (existing) {
      await this._db
        .update(pool)
        .set({
          stakesHeld: sql`GREATEST(0, ${pool.stakesHeld} - ${totalDollars})`,
          balance: sql`${pool.balance} + ${poolDollars}`,
          totalRakeCollected: sql`${pool.totalRakeCollected} + ${rakeDollars}`,
          updatedAt: new Date(),
        })
        .where(eq(pool.id, existing.id));
    } else {
      await this._db.insert(pool).values({
        balance: poolDollars,
        totalRakeCollected: rakeDollars,
        updatedAt: new Date(),
      });
    }

    logger.info("Pool: Forfeit processed", {
      amountCents,
      rakeCents,
      poolCents,
      rakeRate: RAKE.RATE,
    });

    return { totalCents: amountCents, poolCents, rakeCents };
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

    logger.info("Pool: Payout subtracted from stakesHeld", { stakeAmountCents });
  }
}

export const poolService = new PoolService(db);
