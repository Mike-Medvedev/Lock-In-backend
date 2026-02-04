import express from "express";
import * as UserController from "../controllers/user.controller.ts";
import { validatePayload } from "../middleware/validate-payload.middleware.ts";
import { CreateUserModel } from "../models/user.model.ts";
import logger from "../logger/logger.ts";

const UserRouter = express.Router();
UserRouter.get("/", (_, res) => {
  logger.info("Sending Hi");
  res.send("Hi");
});

UserRouter.post("/", validatePayload(CreateUserModel), UserController.createUser);

export default UserRouter;
