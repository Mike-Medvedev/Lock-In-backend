import Stripe from "stripe";
import { z } from "zod";

// --- Zod request/response (meebo) ---
export const CustomerCreateParamsSchema = z.object({
  name: z.string().optional(),
  phone: z.string().optional(),
  email: z.email().optional(),
  metadata: z.record(z.string(), z.string()).optional(),
});

export const CreatePaymentRequestSchema = CustomerCreateParamsSchema.extend({
  amount: z.number().int().positive(),
  currency: z.string().length(3),
  paymentMethodId: z.string().min(1, "paymentMethodId is required"),
  commitmentId: z.uuid(),
});

export const CreatePaymentResponseSchema = z.object({
  paymentIntentId: z.string(),
  clientSecret: z.string(),
  customerSessionClientSecret: z.string(),
  customerId: z.string(),
  publishableKey: z.string(),
});

export type CreatePaymentRequest = z.infer<typeof CreatePaymentRequestSchema>;
export type CreatePaymentResponse = z.infer<typeof CreatePaymentResponseSchema>;

export const ConfirmPaymentRequestSchema = z.object({
  paymentIntentId: z.string().min(1, "paymentIntentId is required"),
});

export const ConfirmPaymentResponseSchema = z.object({
  status: z.string(),
});

export type ConfirmPaymentRequest = z.infer<typeof ConfirmPaymentRequestSchema>;
export type ConfirmPaymentResponse = z.infer<typeof ConfirmPaymentResponseSchema>;

// --- Feature types ---
/** Contact info we read from our users table for Stripe customer creation/lookup. */
export type UserContact = { email: string | null; phone: string | null };

// --- Type exports (Stripe) ---
export type CustomerCreateParams = z.infer<typeof CustomerCreateParamsSchema>;
export type PaymentIntentCreateParams = Stripe.PaymentIntentCreateParams;
export type StripeResponse<T> = Stripe.Response<T>;
export type StripeCustomer = Stripe.Customer;
