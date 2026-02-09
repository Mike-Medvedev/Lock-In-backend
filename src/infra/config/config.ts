import { z } from "zod";
import logger from "@/infra/logger/logger";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().default(3000),
  origins: z.string().transform((val) => val.split(",").map((s) => s.trim())),
  DATABASE_URL: z.url(),
  SUPABASE_PROJECT_URL: z.url(),
  SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  SENTRY_KEY: z.string(),
  STRIPE_API_KEY: z.string(),
  STRIPE_WEBHOOK_SECRET: z.string().min(1).startsWith("whsec_"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  logger.error("Invalid environment variables:");
  logger.error(parsed.error);
  process.exit(1);
}

export const config = parsed.data;
