import express from "express";
import * as UserController from "./user.controller.ts";
import { validatePayload, validateUser } from "@/middleware/type-validation.middleware.ts";
import { CreateUserModel } from "./user.model.ts";

const UserRouter = express.Router();
UserRouter.get("/", validateUser, UserController.selectUser);

UserRouter.post("/", validateUser, validatePayload(CreateUserModel), UserController.createUser);

export default UserRouter;
