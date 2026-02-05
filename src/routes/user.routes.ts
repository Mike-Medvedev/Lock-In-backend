import express from "express";
import * as UserController from "../controllers/user.controller.ts";
import { validatePayload, validateUser } from "@/middleware/validate-payload.middleware.ts";
import { CreateUserModel } from "../models/user.model.ts";

const UserRouter = express.Router();
UserRouter.get("/", validateUser, UserController.selectUser);

UserRouter.post("/", validateUser, validatePayload(CreateUserModel), UserController.createUser);

export default UserRouter;
