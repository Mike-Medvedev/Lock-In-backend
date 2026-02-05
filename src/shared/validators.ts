import { z } from "zod";
import type { ParamsDictionary } from "express-serve-static-core";

export const IdParamsSchema = z.object({ id: z.coerce.number().int().positive() }).loose();

export function validateIdParams(params: ParamsDictionary): number {
  const result = IdParamsSchema.safeParse(params);
  if (!result.success) {
    throw result.error;
  }
  return result.data.id; // returns number directly
}
