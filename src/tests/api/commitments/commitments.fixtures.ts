import { expect } from "vitest";

export const payloads = {
  validCommitment: {
    type: "walk",
    frequency: "three_times_a_week",
    duration: "one_weeks",
    sessionGoal: "steps",
    stakeAmount: 5000,
    lockedBonusAmount: 50,
  },

  missingFields: {
    type: "walk",
    // missing frequency, duration, sessionGoal, stakeAmount
  },

  invalidStakeAmount: {
    type: "walk",
    frequency: "three_times_a_week",
    duration: "one_weeks",
    sessionGoal: "steps",
    stakeAmount: 10, // below 50 minimum
    lockedBonusAmount: 0,
  },
};

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

  commitmentShape: {
    id: expect.any(String),
    type: expect.any(String),
    frequency: expect.any(String),
    duration: expect.any(String),
    sessionGoal: expect.any(String),
    startDate: expect.any(String),
    endDate: expect.any(String),
    stakeAmount: expect.any(Number),
    lockedBonusAmount: expect.any(Number),
    status: expect.any(String),
    gracePeriodEndsAt: expect.any(String),
  },

  cancelPreview: {
    success: true,
    data: {
      id: expect.any(String),
      cancellable: true,
      refundable: false,
      forfeitAmount: 0,
      stakeAmount: 5000,
      gracePeriodEndsAt: expect.any(String),
    },
  },

  cancelResult: {
    success: true,
    data: {
      id: expect.any(String),
      refunded: false,
      forfeitedAmount: 0,
      status: "cancelled",
    },
  },
};
