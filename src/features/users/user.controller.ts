import type { Request, Response } from "express";
import { userService } from "./user.service.ts";
import { MissingUserFromRequest } from "@/shared/errors.ts";

export const selectUser = async (req: Request, res: Response) => {
  req.log.info("Selecting User");
  const user = req.user;
  if (!user) throw new MissingUserFromRequest();
  const selectedUser = await userService.selectUser(user.id);
  return res.status(201).json(selectedUser);
};
