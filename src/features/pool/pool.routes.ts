import express from "express";
import { TypedRouter } from "meebo";
import { PoolController } from "./pool.controller";
import { validateUser } from "@/middleware/auth.middleware";
import { PoolModel } from "./pool.model";
import { ErrorSchema, SuccessSchema } from "@/shared/api-responses";

const PoolRouter = TypedRouter(express.Router(), {
  tag: "Pool",
  basePath: "/api/v1/pool",
});

PoolRouter.use(validateUser);

PoolRouter.get(
  "/",
  {
    responses: {
      200: SuccessSchema(PoolModel),
      401: ErrorSchema,
      500: ErrorSchema,
    },
    summary: "Get pool state",
  },
  PoolController.get,
);

export default PoolRouter;
