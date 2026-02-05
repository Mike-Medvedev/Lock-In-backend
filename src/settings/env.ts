import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().default(3000),
  origins: z.string().transform((val) => val.split(",").map((s) => s.trim())),
  DATABASE_URL: z.url(),
  SUPABASE_PROJECT_URL: z.url(),
  SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  SENTRY_KEY: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Invalid environment variables:");
  console.error(parsed.error);
  process.exit(1);
}

export const env = parsed.data;
