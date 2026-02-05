import "dotenv/config";
import { config } from "@/infra/config/config";
import "@root/sentry.config.js";
import express, { json } from "express";
import cors from "cors";
import { requestLogger } from "@/middleware/logger.middleware.ts";
import UserRouter from "@/features/users/user.routes.ts";
import TransactionRouter from "@/features/transactions/transaction.routes.ts";
import CommitmentRouter from "@/features/commitments/commitment.routes.ts";
import errorHandler from "@/middleware/error.middleware.ts";
import logger from "@/infra/logger/logger";
import helmet from "helmet";
import compression from "compression";
import gracefulShutdown from "@/shutdown.ts";
import { limiter } from "@/middleware/rate-limit.middleware.ts";

const allowedOrigins = config.origins;

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

// Apply middleware
app.use(requestLogger);
app.use(helmet());
app.use(compression({ threshold: "1kb" })); // Only compress responses > 1kb
app.use(cors(corsOptions));
app.use(json({ limit: "100kb" }));
app.use(limiter);

app.use("/users", UserRouter);
app.use("/transactions", TransactionRouter);
app.use("/commitments", CommitmentRouter);

app.get("/test-compression", (_, res) => {
  const largeData = { items: Array(100).fill({ name: "test", value: 12345 }) };
  res.json(largeData);
});

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
if (config.NODE_ENV === "production") {
  gracefulShutdown(server);
}
