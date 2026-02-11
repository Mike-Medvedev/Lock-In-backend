import { expect } from "vitest";

// ─── Request Payloads ────────────────────────────────────────────────

export const payloads = {
  commitment: {
    type: "walk",
    frequency: "three_times_a_week",
    duration: "one_weeks",
    sessionGoal: "steps",
    stakeAmount: 5000,
    lockedBonusAmount: 50,
  },

  payment: (commitmentId: string) => ({
    name: "bob",
    phone: "dylan",
    email: "bobdylan@yahoo.com",
    metadata: {
      additionalProp1: "string",
      additionalProp2: "string",
      additionalProp3: "string",
    },
    amount: 250,
    currency: "usd",
    paymentMethodId: "pm_card_us",
    commitmentId,
  }),

  session: (commitmentId: string) => ({
    commitmentId,
    timezone: "America/Los_Angeles",
  }),

  movementData: {
    motionSamples: [
      {
        capturedAt: "2026-02-10T05:45:00.000Z",
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
      {
        capturedAt: "2026-02-10T05:45:00.100Z",
        intervalMs: 100,
        accelX: 0.18,
        accelY: -0.29,
        accelZ: 1.05,
        accelGX: 0.21,
        accelGY: -9.68,
        accelGZ: 1.09,
        rotAlpha: 45.5,
        rotBeta: 12.3,
        rotGamma: -3.2,
        rotRateAlpha: 0.6,
        rotRateBeta: -0.2,
        rotRateGamma: 0.15,
        orientation: 0,
      },
    ],
    gpsSamples: [
      {
        capturedAt: "2026-02-10T05:45:00.000Z",
        lat: 34.0522,
        lng: -118.2437,
        speedMps: 1.4,
        headingDeg: 90.0,
        horizAcc: 5.2,
      },
      {
        capturedAt: "2026-02-10T05:45:05.000Z",
        lat: 34.0523,
        lng: -118.2436,
        speedMps: 1.3,
        headingDeg: 88.5,
        horizAcc: 4.8,
      },
    ],
    pedometerSamples: [
      {
        capturedAt: "2026-02-10T05:45:30.000Z",
        steps: 47,
      },
    ],
  },
};

// ─── Expected Responses ──────────────────────────────────────────────

export const expected = {
  commitment: {
    success: true,
    data: {
      id: expect.any(String),
      type: "walk",
      frequency: "three_times_a_week",
      duration: "one_weeks",
      sessionGoal: "steps",
      startDate: expect.any(String),
      endDate: expect.any(String),
      stakeAmount: 5000,
      lockedBonusAmount: 50,
      status: "pending_payment",
      gracePeriodEndsAt: expect.any(String),
    },
  },

  payment: {
    success: true,
    data: {
      paymentIntentId: expect.any(String),
      clientSecret: expect.any(String),
      customerSessionClientSecret: expect.any(String),
      customerId: expect.any(String),
      publishableKey: expect.any(String),
    },
  },

  paymentConfirmed: {
    success: true,
    data: { status: "succeeded" },
  },

  session: (commitmentId: string) => ({
    success: true,
    data: {
      id: expect.any(String),
      userId: expect.any(String),
      commitmentId,
      startDate: expect.any(String),
      endDate: null,
      createdAt: expect.any(String),
      completedAt: null,
      timezone: "America/Los_Angeles",
      countingDay: expect.any(String),
      sessionDuration: expect.any(Number),
      sessionStatus: "in_progress",
      verificationStatus: "not_started",
      sessionGoal: expect.any(String),
      actualValue: null,
      flaggedForReview: false,
      fraudDetected: false,
      reviewNotes: null,
    },
  }),

  movementData: {
    success: true,
    data: {
      motionSamplesInserted: 2,
      gpsSamplesInserted: 2,
      pedometerSamplesInserted: 1,
    },
  },

  completedSession: (sessionId: string, commitmentId: string) => ({
    success: true,
    data: {
      id: sessionId,
      userId: expect.any(String),
      commitmentId,
      startDate: expect.any(String),
      endDate: expect.any(String),
      createdAt: expect.any(String),
      completedAt: expect.any(String),
      timezone: "America/Los_Angeles",
      countingDay: expect.any(String),
      sessionDuration: 0,
      sessionStatus: "completed",
      verificationStatus: "pending",
      sessionGoal: "steps",
      actualValue: null,
      flaggedForReview: false,
      fraudDetected: false,
      reviewNotes: null,
    },
  }),

  verificationSubmitted: {
    success: true,
    data: "Submitted Session for Verification",
  },
};
