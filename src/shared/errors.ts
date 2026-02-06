import type { DrizzleQueryError } from "drizzle-orm/errors";

export { ZodError } from "zod";

/**
 * PostgreSQL error codes
 * @see https://www.postgresql.org/docs/current/errcodes-appendix.html
 */
export const PG_ERROR_CODES = {
  UNIQUE_VIOLATION: "23505",
  FOREIGN_KEY_VIOLATION: "23503",
  CHECK_VIOLATION: "23514",
  NOT_NULL_VIOLATION: "23502",
  INTEGRITY_CONSTRAINT_VIOLATION: "23000",
} as const;

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

export class DatabaseResourceNotFoundError extends Error {
  constructor() {
    super("resource not found");
    this.name = "DatabaseResourceNotFoundError";
  }
}

export class UnauthorizedDatabaseRequestError extends Error {
  constructor() {
    super("Unauthorized request");
    this.name = "UnauthorizedDatabaseRequestError";
  }
}

export class MultipleActiveCommitmentsError extends Error {
  constructor() {
    super("User already has an active commitment ");
    this.name = "MultipleActiveCommitmentsError";
  }
}

export class CommitmentAlreadyCancelledError extends Error {
  constructor() {
    super("Commitment has already been cancelled");
    this.name = "CommitmentAlreadyCancelledError";
  }
}

export class CommitmentAlreadyForfeitedError extends Error {
  constructor() {
    super("Commitment has already been forfeited");
    this.name = "CommitmentAlreadyForfeitedError";
  }
}

export class CommitmentAlreadyCompletedError extends Error {
  constructor() {
    super("Commitment has already been completed");
    this.name = "CommitmentAlreadyCompletedError";
  }
}
