import type { DrizzleQueryError } from "drizzle-orm/errors";

export { ZodError } from "zod";

/**
 * Wraps database errors and extracts the error code.
 */
export class DatabaseError extends Error {
  code?: string;

  constructor(error: DrizzleQueryError) {
    const cause = error.cause as { code?: string; message?: string } | undefined;

    super(cause?.message || error.message, { cause: error });
    this.name = "DatabaseError";
    if (cause?.code) this.code = cause.code;
  }
}

/**
 * Wraps unexpected errors.
 */
export class UnknownError extends Error {
  constructor(error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    super(message, { cause: error instanceof Error ? error : undefined });
    this.name = "UnknownError";
  }
}
