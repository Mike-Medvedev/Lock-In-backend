import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { gpsSamples, motionSamples, pedometerSamples, sessionStatus } from "@/infra/db/schema.ts";
import { z } from "zod";

export const MotionSampleModel = createSelectSchema(motionSamples);
export const GpsSampleModel = createSelectSchema(gpsSamples);
export const PedometerSampleModel = createSelectSchema(pedometerSamples);
export const SessionStatusEnum = createSelectSchema(sessionStatus);

// ── Insert schemas (what the frontend sends) ──────────────────────────

export const CreateMotionSampleModel = createInsertSchema(motionSamples)
  .pick({
    capturedAt: true,
    intervalMs: true,
    accelX: true,
    accelY: true,
    accelZ: true,
    accelGX: true,
    accelGY: true,
    accelGZ: true,
    rotAlpha: true,
    rotBeta: true,
    rotGamma: true,
    rotRateAlpha: true,
    rotRateBeta: true,
    rotRateGamma: true,
    orientation: true,
  })
  .extend({
    capturedAt: z.coerce.date(),
  });

export const CreateGpsSampleModel = createInsertSchema(gpsSamples)
  .pick({
    capturedAt: true,
    lat: true,
    lng: true,
    speedMps: true,
    headingDeg: true,
    horizAcc: true,
  })
  .extend({
    capturedAt: z.coerce.date(),
  });

export const CreatePedometerSampleModel = createInsertSchema(pedometerSamples)
  .pick({
    capturedAt: true,
    steps: true,
  })
  .extend({
    capturedAt: z.coerce.date(),
  });

// ── Batch upload payload (sent from frontend during a session) ─────────

export const BatchSamplesModel = z
  .object({
    motionSamples: z.array(CreateMotionSampleModel).default([]),
    gpsSamples: z.array(CreateGpsSampleModel).default([]),
    pedometerSamples: z.array(CreatePedometerSampleModel).default([]),
  })
  .strict();

// ── Batch upload response ──────────────────────────────────────────────

export const BatchSamplesResponseModel = z.object({
  motionSamplesInserted: z.number(),
  gpsSamplesInserted: z.number(),
  pedometerSamplesInserted: z.number(),
});

// ── Get samples response ──────────────────────────────────────────────

export const GetSamplesResponseModel = z.object({
  motionSamples: z.array(MotionSampleModel),
  gpsSamples: z.array(GpsSampleModel),
  pedometerSamples: z.array(PedometerSampleModel),
});

// ── Types ──────────────────────────────────────────────────────────────

export type MotionSample = z.infer<typeof MotionSampleModel>;
export type GpsSample = z.infer<typeof GpsSampleModel>;
export type PedometerSample = z.infer<typeof PedometerSampleModel>;
export type CreateMotionSample = z.infer<typeof CreateMotionSampleModel>;
export type CreateGpsSample = z.infer<typeof CreateGpsSampleModel>;
export type CreatePedometerSample = z.infer<typeof CreatePedometerSampleModel>;
export type BatchSamples = z.infer<typeof BatchSamplesModel>;
export type BatchSamplesResponse = z.infer<typeof BatchSamplesResponseModel>;
