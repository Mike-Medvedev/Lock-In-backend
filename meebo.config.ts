import { configureMeebo } from "meebo";

/**
 * Configure meebo error responses to match our API format.
 * Import this file before any routes are registered.
 */
configureMeebo({
  formatError: (context) => ({
    success: false,
    statusCode: context.type === "response" ? 500 : 422,
    name: "ValidationError",
    message: `${context.type.charAt(0).toUpperCase() + context.type.slice(1)} validation failed`,
    detail: context.zodError.issues.map((issue) => ({
      field: issue.path.join("."),
      message: issue.message,
    })),
  }),
});
