import { db, type DB } from "@/infra/db/db.ts";
import type { z } from "zod";
import { PoolModel } from "./pool.model";
import { DatabaseResourceNotFoundError } from "@/shared/errors";

class PoolService {
  constructor(private readonly _db: DB) {}

  async get(): Promise<z.infer<typeof PoolModel>> {
    console.log(this._db);
    throw new DatabaseResourceNotFoundError();
  }
}

export const poolService = new PoolService(db);
