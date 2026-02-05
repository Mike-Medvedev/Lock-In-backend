import express from "express";
import * as UserController from "./user.controller.ts";
import { validateUser } from "@/middleware/type-validation.middleware.ts";

const UserRouter = express.Router();

UserRouter.get("/", validateUser, UserController.selectUser);

export default UserRouter;
