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

export class MissingTokenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MissingTokenError";
  }
}

export class MissingUserFromRequest extends Error {
  constructor() {
    super("User missing from request req.user");
    this.name = "MissingUserFromRequest";
  }
}
