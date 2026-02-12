import { expect } from "vitest";

export const payloads = {
  session: (commitmentId: string) => ({
    commitmentId,
    timezone: "America/Los_Angeles",
  }),

  movementData: {
    motionSamples: [
      {
        capturedAt: "2026-02-10T16:00:00.000Z",
        intervalMs: 100,
        accelX: 0.12,
        accelY: -0.34,
        accelZ: 0.98,
        accelGX: 0.15,
        accelGY: -9.75,
        accelGZ: 1.02,
        rotAlpha: 45.2,
        rotBeta: 12.1,
        rotGamma: -3.5,
        rotRateAlpha: 0.5,
        rotRateBeta: -0.3,
        rotRateGamma: 0.1,
        orientation: 0,
      },
    ],
    gpsSamples: [
      {
        capturedAt: "2026-02-10T16:00:00.000Z",
        lat: 34.0522,
        lng: -118.2437,
        speedMps: 1.4,
        headingDeg: 90.0,
        horizAcc: 5.2,
      },
    ],
    pedometerSamples: [
      {
        capturedAt: "2026-02-10T16:00:30.000Z",
        steps: 47,
      },
    ],
  },
};

export const expected = {
  sessionShape: {
    id: expect.any(String),
    userId: expect.any(String),
    commitmentId: expect.any(String),
    startDate: expect.any(String),
    createdAt: expect.any(String),
    timezone: "America/Los_Angeles",
    countingDay: expect.any(String),
    sessionDuration: expect.any(Number),
    sessionGoal: expect.any(String),
    flaggedForReview: false,
    fraudDetected: false,
  },

  movementData: {
    success: true,
    data: {
      motionSamplesInserted: 1,
      gpsSamplesInserted: 1,
      pedometerSamplesInserted: 1,
    },
  },

  samplesShape: {
    success: true,
    data: {
      motionSamples: expect.any(Array),
      gpsSamples: expect.any(Array),
      pedometerSamples: expect.any(Array),
    },
  },

  verificationSubmitted: {
    success: true,
    data: "Submitted Session for Verification",
  },
};
