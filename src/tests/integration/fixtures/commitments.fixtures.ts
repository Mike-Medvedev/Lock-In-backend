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

  // 3 in_progress sessions on Mon/Wed/Fri of the current week for direct DB insert
  sessions: (commitmentId: string, userId: string) => [
    {
      userId,
      commitmentId,
      timezone: "America/Los_Angeles",
      countingDay: "2026-02-09",
      startDate: new Date("2026-02-09T08:00:00-08:00"),
      sessionGoal: "steps" as const,
      sessionStatus: "in_progress" as const,
    },
    {
      userId,
      commitmentId,
      timezone: "America/Los_Angeles",
      countingDay: "2026-02-11",
      startDate: new Date("2026-02-11T08:00:00-08:00"),
      sessionGoal: "steps" as const,
      sessionStatus: "in_progress" as const,
    },
    {
      userId,
      commitmentId,
      timezone: "America/Los_Angeles",
      countingDay: "2026-02-13",
      startDate: new Date("2026-02-13T08:00:00-08:00"),
      sessionGoal: "steps" as const,
      sessionStatus: "in_progress" as const,
    },
  ],

  /**
   * Generate realistic 12-minute walking data that passes the verification pipeline.
   *
   * Requirements for "walk" commitment:
   *  - Session >= 60s (we do ~12 min)
   *  - GPS: >= 3/min (we do 2/min = 24 total at 30s intervals)
   *  - Motion: >= 30/min (we do 60/min = 720 total at 1s intervals)
   *  - Accel RMS >= 0.3 m/s²
   *  - Speed <= 7 mph (~3.1 m/s); we walk at ~1.3 m/s (~3 mph)
   *  - Pedometer: 30–180 steps/min (we do ~167/min = 2000 total over 12 min)
   *  - minSteps >= 2000 (we do 2000)
   *  - No GPS teleportation
   */
  movementDataForSession: (sessionDate: string) => {
    const baseTime = new Date(`${sessionDate}T16:00:00.000Z`).getTime();

    // Walking east in LA: ~1.3 m/s. 1° lng ≈ 92,000m at 34°N, so 1.3m/s * 30s ≈ 0.00042° lng per GPS tick.
    const startLat = 34.0522;
    const startLng = -118.2437;
    const lngPerTick = 0.00042;

    // 24 GPS samples at 30-second intervals (~12 minutes) — duration drives steps/min calculation
    const gpsSamples = Array.from({ length: 24 }, (_, i) => ({
      capturedAt: new Date(baseTime + i * 30000).toISOString(),
      lat: startLat + (Math.random() - 0.5) * 0.00001, // tiny lat jitter
      lng: startLng + i * lngPerTick,
      speedMps: 1.2 + Math.random() * 0.3, // 1.2–1.5 m/s
      headingDeg: 88 + Math.random() * 4, // roughly east
      horizAcc: 3 + Math.random() * 4, // 3–7m accuracy
    }));

    // 720 motion samples at 1-second intervals (12 minutes)
    const motionSamples = Array.from({ length: 720 }, (_, i) => {
      const phase = (i * Math.PI) / 4; // simulate gait oscillation
      return {
        capturedAt: new Date(baseTime + i * 1000).toISOString(),
        intervalMs: 1000,
        accelX: 0.3 * Math.sin(phase) + (Math.random() - 0.5) * 0.2,
        accelY: 0.2 * Math.cos(phase) + (Math.random() - 0.5) * 0.15,
        accelZ: 0.6 + Math.random() * 0.4, // vertical bounce from walking
        accelGX: 0.3 * Math.sin(phase),
        accelGY: -9.75 + 0.2 * Math.cos(phase),
        accelGZ: 1.0 + Math.random() * 0.3,
        rotAlpha: 45 + Math.random() * 2,
        rotBeta: 12 + Math.random() * 2,
        rotGamma: -3 + Math.random() * 2,
        rotRateAlpha: 0.5 + Math.random() * 0.3,
        rotRateBeta: -0.3 + Math.random() * 0.2,
        rotRateGamma: 0.1 + Math.random() * 0.1,
        orientation: 0,
      };
    });

    // 4 pedometer readings at 3-minute intervals. 2000 steps over 12 min = ~167 steps/min (≤ 180 for walk)
    const pedometerSamples = Array.from({ length: 4 }, (_, i) => ({
      capturedAt: new Date(baseTime + (i + 1) * 180000).toISOString(),
      steps: (i + 1) * 500, // 500, 1000, 1500, 2000 cumulative
    }));

    return { motionSamples, gpsSamples, pedometerSamples };
  },

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

  insertedSession: (commitmentId: string, userId: string, countingDay: string) => ({
    id: expect.any(String),
    userId,
    commitmentId,
    startDate: expect.any(Date),
    endDate: null,
    createdAt: expect.any(Date),
    completedAt: null,
    timezone: "America/Los_Angeles",
    countingDay,
    sessionDuration: 0,
    sessionStatus: "in_progress",
    verificationStatus: "not_started",
    sessionGoal: "steps",
    actualValue: null,
    flaggedForReview: false,
    fraudDetected: false,
    reviewNotes: null,
  }),

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
      gpsSamplesInserted: 24,
      motionSamplesInserted: 720,
      pedometerSamplesInserted: 4,
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
