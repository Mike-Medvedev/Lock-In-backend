import { expect } from "vitest";

export const payloads = {
  payment: (commitmentId: string) => ({
    name: "Test User",
    phone: "1234567890",
    email: "test@example.com",
    amount: 250,
    currency: "usd",
    paymentMethodId: "pm_card_us",
    commitmentId,
  }),
};

export const expected = {
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
};
