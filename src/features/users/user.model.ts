import type z from "zod";
import { users } from "@/infra/db/schema.ts";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

export const SelectUserModel = createSelectSchema(users).omit({
  createdAt: true,
  updatedAt: true,
});
export type SelectUser = z.infer<typeof SelectUserModel>;

export const CreateUserModel = createInsertSchema(users);
export type CreateUser = z.infer<typeof CreateUserModel>;
