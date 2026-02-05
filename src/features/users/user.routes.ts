import express from "express";
import * as UserController from "./user.controller.ts";
import { validateUser } from "@/middleware/auth.middleware";
import { TypedRouter } from "meebo";
import z from "zod";

const UserRouter = TypedRouter(express.Router(), {
  tag: "users",
  basePath: "/users",
});

UserRouter.use(validateUser);

UserRouter.get("/", { response: z.string() }, UserController.selectUser);

export default UserRouter;
