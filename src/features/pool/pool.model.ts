import { createSelectSchema } from "drizzle-zod";
import { pool } from "@/infra/db/schema.ts";
import { z } from "zod";

export const PoolModel = createSelectSchema(pool);

export const ForfeitBreakdownModel = z.object({
  /** Total forfeited amount in cents. */
  totalCents: z.number(),
  /** Amount added to pool balance (available for bonuses) in cents. */
  poolCents: z.number(),
  /** Amount taken as platform rake in cents. */
  rakeCents: z.number(),
});

export type ForfeitBreakdown = z.infer<typeof ForfeitBreakdownModel>;
