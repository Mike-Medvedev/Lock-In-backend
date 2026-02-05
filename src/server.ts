import "dotenv/config";
import { env } from "@/infra/env.ts";
import "@root/sentry.config.js";
import express, { json } from "express";
import cors from "cors";
import { requestLogger } from "@/middleware/logger.middleware.ts";
import UserRouter from "@/features/users/user.routes.ts";
import TransactionRouter from "@/features/transactions/transaction.routes.ts";
import CommitmentRouter from "@/features/commitments/commitment.routes.ts";
import errorHandler from "@/middleware/error.middleware.ts";
import logger from "@/infra/logger.ts";
import helmet from "helmet";
import gracefulShutdown from "@/shutdown.ts";
import { limiter } from "@/middleware/rate-limit.middleware.ts";

const allowedOrigins = env.origins;

if (!allowedOrigins || allowedOrigins.length === 0) {
  logger.error("Failed to start: CORS origins environment variable is missing or empty");
  throw new Error("Cors origin env variables required!");
}

const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) {
      callback(null, true);
      return;
    }
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    } else {
      callback(new Error(`Origin ${origin} not allowed`));
      return;
    }
  },
};

const app = express();

// Apply the rate limiting middleware to all requests.
app.use(helmet());
app.use(cors(corsOptions));
app.use(json());
app.use(requestLogger);
app.use(limiter);

app.use("/users", UserRouter);
app.use("/transactions", TransactionRouter);
app.use("/commitments", CommitmentRouter);

app.get("/", (_, res) => {
  logger.info("Logging");
  res.send("Hello World");
});
app.get("/health", (_, res) => {
  logger.info("healthy");
  res.status(200).json({ status: "healthy" });
});

app.use(errorHandler);

const server = app.listen(3000, "0.0.0.0", (): void => {
  logger.info(`Server listening on port ${3000}`);
});
if (env.NODE_ENV === "production") {
  gracefulShutdown(server);
}
