import express from "express";
import { TypedRouter } from "meebo";
import { CronController } from "./cron.controller";
import { validateCronSecret } from "./cron.middleware.ts";
import { ForfeitExpiredResponseModel } from "./cron.model";
import { SuccessSchema, ErrorSchema } from "@/shared/api-responses";

const CronRouter = TypedRouter(express.Router(), {
  tag: "Cron",
  basePath: "/cron",
});

CronRouter.use(validateCronSecret);

CronRouter.post(
  "/forfeit-expired",
  {
    summary: "Forfeit expired commitments",
    description:
      "Called by Supabase pg_cron at 2am UTC daily. Finds active commitments past their end date with insufficient verified sessions and forfeits them.",
    responses: {
      200: SuccessSchema(ForfeitExpiredResponseModel),
      401: ErrorSchema,
      500: ErrorSchema,
    },
  },
  CronController.forfeitExpired,
);

export default CronRouter;
