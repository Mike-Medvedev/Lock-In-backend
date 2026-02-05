import { createSelectSchema } from "drizzle-zod";
import { gpsSamples, motionSamples, sessionStatus } from "@/infra/db/schema.ts";

export const MotionSamples = createSelectSchema(motionSamples);
export const GpsSamples = createSelectSchema(gpsSamples);
export const SessionStatusEnum = createSelectSchema(sessionStatus);
