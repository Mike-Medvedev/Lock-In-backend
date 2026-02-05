import "express-serve-static-core";
import type { Logger } from "winston";
import type { User } from "@supabase/supabase-js";

declare module "express-serve-static-core" {
  interface Response {
    success<T>(data: T, statusCode?: number): void;
    error(statusCode: number, error: Error, detail?: unknown): void;
  }
  interface Request {
    validated?: unknown;
    id?: string;
    log: Logger;
    user?: User;
  }
}
