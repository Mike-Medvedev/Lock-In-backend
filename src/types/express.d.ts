import "express-serve-static-core";
import type { Logger } from "winston";

declare module "express-serve-static-core" {
  interface Request {
    validated?: unknown;
    id?: string;
    log: Logger;
  }
}
