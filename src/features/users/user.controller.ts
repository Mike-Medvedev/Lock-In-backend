import type { Request, Response } from "express";
import { type CreateUser } from "./user.model.ts";
import { userService } from "./user.service.ts";
import { MissingUserFromRequest } from "@/shared/errors.ts";

export const createUser = async (req: Request, res: Response) => {
  req.log.info("Creating User");
  const validatedUser = req.validated as CreateUser;
  const user = await userService.createUser(validatedUser);
  return res.status(201).json(user);
};

export const selectUser = async (req: Request, res: Response) => {
  req.log.info("Selecting User");
  const user = req.user;
  if (!user) throw new MissingUserFromRequest();
  const selectedUser = await userService.selectUser(user.id);
  return res.status(201).json(selectedUser);
};
