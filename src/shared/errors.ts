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

export class CommitmentPaymentNotFoundError extends Error {
  constructor() {
    super("No payment found for this commitment; cannot refund");
    this.name = "CommitmentPaymentNotFoundError";
  }
}

export class CommitmentRefundPendingError extends Error {
  constructor() {
    super("Refund is already in progress for this commitment");
    this.name = "CommitmentRefundPendingError";
  }
}

export class CommitmentAlreadyStakedError extends Error {
  constructor() {
    super("A payment has already been made for this commitment");
    this.name = "CommitmentAlreadyStakedError";
  }
}

export class CommitmentPaymentPendingError extends Error {
  constructor() {
    super("Payment is still processing. Please wait for it to settle before cancelling.");
    this.name = "CommitmentPaymentPendingError";
  }
}

export class SessionAlreadyExistsForDayError extends Error {
  constructor() {
    super("A session has already been completed for this commitment today — try again tomorrow");
    this.name = "SessionAlreadyExistsForDayError";
  }
}

export class CommitmentNotActiveError extends Error {
  constructor() {
    super("Commitment is not active");
    this.name = "CommitmentNotActiveError";
  }
}

export class SessionNotInProgressError extends Error {
  constructor() {
    super("Session is not in progress — cannot complete or upload samples");
    this.name = "SessionNotInProgressError";
  }
}

export class SessionAlreadyActiveError extends Error {
  constructor() {
    super("An in-progress or paused session already exists for this commitment");
    this.name = "SessionAlreadyActiveError";
  }
}

export class SessionAlreadyCompletedError extends Error {
  constructor() {
    super("Session has already been completed");
    this.name = "SessionAlreadyCompletedError";
  }
}

export class SessionAlreadyCancelledError extends Error {
  constructor() {
    super("Session has already been cancelled");
    this.name = "SessionAlreadyCancelledError";
  }
}

export class SessionAlreadyPausedError extends Error {
  constructor() {
    super("Session is already paused");
    this.name = "SessionAlreadyPausedError";
  }
}

export class SessionNotPausedError extends Error {
  constructor() {
    super("Session is not paused — cannot resume");
    this.name = "SessionNotPausedError";
  }
}

export class SessionNotCompletedError extends Error {
  constructor() {
    super("Session is not completed — cannot verify");
    this.name = "SessionNotCompletedError";
  }
}

export class SessionAlreadyVerifiedError extends Error {
  constructor() {
    super("Session has already been verified");
    this.name = "SessionAlreadyVerifiedError";
  }
}

export class PayoutError extends Error {
  constructor(message: string, cause?: Error) {
    super(message, { cause });
    this.name = "PayoutError";
  }
}

export class InvalidPaymentRequestError extends Error {
  constructor(error: Error) {
    super("Invalid payment parameters. Please check the request and try again.", {
      cause: error,
    });
    this.name = "InvalidPaymentRequestError";
  }
}

/** Thrown when Stripe returns a Payment Intent or Customer Session without a client_secret. */
export class MissingPaymentSecretError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MissingPaymentSecretError";
  }
}

/** Thrown when confirming a Payment Intent fails (invalid id, wrong state, Stripe error). */
export class PaymentConfirmError extends Error {
  constructor(message: string, cause?: Error) {
    super(message, { cause });
    this.name = "PaymentConfirmError";
  }
}

export class PaymentProviderError extends Error {
  constructor(message: string, error: Error) {
    super(message, { cause: error });
    this.name = "PaymentProviderError";
  }
}

export class CustomerNotFoundError extends Error {
  constructor(error: Error) {
    super("Requested Customer not found", { cause: error });
    this.name = "CustomerNotFound";
  }
}

export class NoValidStripeSignatureError extends Error {
  constructor(message: string, error?: Error) {
    super(message, { cause: error });
    this.name = "NoValidStripeSignatureError";
  }
}
/**
 * Generic error that wraps an underlying cause. Use when wrapping Stripe/DB/other errors
 * with a clearer message. Handled in error middleware (logs cause, responds with message).
 */
export class AppError extends Error {
  statusCode: number;

  constructor(message: string, cause?: Error, statusCode = 500) {
    super(message, { cause });
    this.name = "AppError";
    this.statusCode = statusCode;
  }
}
