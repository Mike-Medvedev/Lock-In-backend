import type z from "zod";
import { users } from "@/infra/db/schema.ts";
import { createSelectSchema } from "drizzle-zod";

export const SelectUserModel = createSelectSchema(users).omit({
  createdAt: true,
  updatedAt: true,
});
export type SelectUser = z.infer<typeof SelectUserModel>;
