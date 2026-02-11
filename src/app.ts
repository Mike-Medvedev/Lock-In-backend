import { config } from "@/infra/config/config";
import express, { json, raw } from "express";
import cors from "cors";
import { requestLogger } from "@/middleware/logger.middleware.ts";
import UserRouter from "@/features/users/user.routes.ts";
import TransactionRouter from "@/features/transactions/transaction.routes.ts";
import CommitmentRouter from "@/features/commitments/commitment.routes.ts";
import CommitmentSessionsRouter from "@/features/commitment-sessions/commitment-sessions.routes.ts";
import PaymentsRouter from "@/features/payments/payments.routes.ts";
import PoolRouter from "@/features/pool/pool.routes.ts";
import Webhook from "@/features/webhooks/webhooks.routes";
import CronRouter from "@/features/cron/cron.routes";
import errorHandler from "@/middleware/error.middleware.ts";
import logger from "@/infra/logger/logger";
import helmet from "helmet";
import compression from "compression";
import { limiter } from "@/middleware/rate-limit.middleware.ts";
import { swagger } from "meebo";
import { responseHelpers } from "@/middleware/response.middleware";
import packageJson from "@root/package.json" with { type: "json" };

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
const v1Router = express.Router();

app.use(requestLogger);
app.use(helmet());
app.use(compression({ threshold: "1kb" }));
app.use(cors(corsOptions));
app.use(responseHelpers);

//TODO MAKE WEBHOOK PART OF V1ROUTER BY CHANGING ENDPOINT URL REGISTERED WITH STRIPE TO USE /API/V1
// Webhook must receive raw body for Stripe signature verification; mount before json()
app.use("/webhook", raw({ type: "application/json" }), Webhook);
app.use(json({ limit: "100kb" }));
app.use(limiter);

// Internal cron endpoints — authenticated via CRON_SECRET, not user JWT
app.use("/cron", CronRouter);

v1Router.use("/users", UserRouter);
v1Router.use("/transactions", TransactionRouter);
v1Router.use("/commitments", CommitmentRouter);
v1Router.use("/commitment-sessions", CommitmentSessionsRouter);
v1Router.use("/payments", PaymentsRouter);
v1Router.use("/pool", PoolRouter);
app.use("/api/v1", v1Router);
app.use(swagger("Lock In", { bearerAuth: true, version: packageJson.version }));

app.get("/test-compression", (_, res) => {
  const largeData = { items: Array(100).fill({ name: "test", value: 12345 }) };
  res.json(largeData);
});

app.get("/", (_, res) => {
  res.send("Hello World");
});
app.get("/health", (_, res) => {
  logger.info("healthy");
  res.status(200).json({ status: "healthy" });
});

app.use(errorHandler);

export default app;
