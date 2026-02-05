import "express-serve-static-core";
import type { Logger } from "winston";
import type { User } from "@supabase/supabase-js";

declare module "express-serve-static-core" {
  interface Request {
    validated?: unknown;
    id?: string;
    log: Logger;
    user?: User;
  }
}
