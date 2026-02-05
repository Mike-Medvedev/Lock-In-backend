import type { Request, Response, NextFunction } from "express";
import { ErrorApiResponse, SuccessApiResponse } from "@/shared/api-responses";

export function responseHelpers(_req: Request, res: Response, next: NextFunction) {
  res.success = function <T>(data: T, statusCode = 200) {
    this.status(statusCode).json(SuccessApiResponse(data));
  };

  res.error = function (statusCode: number, error: Error, detail?: unknown) {
    this.status(statusCode).json(ErrorApiResponse(statusCode, error, detail));
  };

  next();
}
