import { createSelectSchema } from "drizzle-zod";
import { pool } from "@/infra/db/schema.ts";

export const PoolModel = createSelectSchema(pool);
