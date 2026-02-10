import {
  CustomerNotFoundError,
  InvalidPaymentRequestError,
  PaymentConfirmError,
} from "@/shared/errors";
import logger from "@/infra/logger/logger";
import stripe from "@/infra/payments/payments.client";
import { db, type DB } from "@/infra/db/db.ts";
import { users } from "@/infra/db/schema.ts";
import { eq } from "drizzle-orm";
import type {
  CustomerCreateParams,
  PaymentIntentCreateParams,
  StripeCustomer,
  StripeResponse,
  UserContact,
} from "@/features/payments/payments.models";
import { normalizeEmail } from "@/shared/string";
import type Stripe from "stripe";

class PaymentService {
  constructor(private readonly _db: DB) {}

  // --- Customer resolution (get-or-create) ---

  /**
   * Returns the Stripe customer for this user. Resolution order:
   * 1. Customer already linked in our DB (by userId) → return if not deleted.
   * 2. User has email → look up existing Stripe customer by email → link and return (avoids duplicates).
   * 3. Create new Stripe customer, link to user, return.
   */
  async getOrCreateCustomer(userId: string): Promise<StripeCustomer> {
    const linked = await this.getLinkedCustomer(userId);
    if (linked) return linked;

    const contact = await this.getUserContact(userId);
    const existingByEmail = contact.email
      ? await this.findStripeCustomerByEmail(contact.email)
      : null;
    if (existingByEmail) {
      await this.linkCustomerToUser(userId, existingByEmail.id);
      logger.info("Linked existing Stripe customer to user (dedupe by email)", {
        userId,
        stripeCustomerId: existingByEmail.id,
        email: contact.email,
      });
      return existingByEmail;
    }

    return this.createAndLinkCustomer(userId, contact);
  }

  /** Linked Stripe customer id for this user, or undefined. */
  async findExistingCustomer(userId: string): Promise<string | undefined> {
    const [row] = await this._db
      .select({ stripeCustomerId: users.stripeCustomerId })
      .from(users)
      .where(eq(users.id, userId));
    return row?.stripeCustomerId ?? undefined;
  }

  /** Resolve linked customer from DB; returns null if none or if Stripe customer was deleted. */
  private async getLinkedCustomer(userId: string): Promise<StripeCustomer | null> {
    const stripeId = await this.findExistingCustomer(userId);
    if (!stripeId) return null;

    const customer = await this.retrieveCustomer(stripeId);
    if (customer.deleted) {
      logger.warn("Linked Stripe customer was deleted; will create or reuse by email", {
        stripeId,
        userId,
      });
      return null;
    }
    return customer as StripeCustomer;
  }

  /** Fetch email/phone for user from our DB. */
  private async getUserContact(userId: string): Promise<UserContact> {
    const [row] = await this._db
      .select({ email: users.email, phone: users.phone })
      .from(users)
      .where(eq(users.id, userId));
    return {
      email: row?.email ?? null,
      phone: row?.phone ?? null,
    };
  }

  /** Find a non-deleted Stripe customer by email (case-insensitive). Returns first match or null. */
  private async findStripeCustomerByEmail(email: string): Promise<StripeCustomer | null> {
    const normalized = normalizeEmail(email);
    const { data } = await stripe.customers.list({ email: normalized, limit: 1 });
    const customer = data[0];
    if (!customer || customer.deleted) return null;
    return customer as StripeCustomer;
  }

  /** Persist Stripe customer id on our user row. Idempotent. */
  async linkStripeCustomerToUser(userId: string, stripeCustomerId: string): Promise<void> {
    await this._db
      .update(users)
      .set({ stripeCustomerId, updatedAt: new Date() })
      .where(eq(users.id, userId));
  }

  private linkCustomerToUser = this.linkStripeCustomerToUser;

  /** Build Stripe create params from contact; only include defined fields (exactOptionalPropertyTypes). */
  private buildStripeCustomerParams(
    userId: string,
    contact: UserContact,
  ): Stripe.CustomerCreateParams {
    const params: Stripe.CustomerCreateParams = { metadata: { userId } };
    if (contact.email) params.email = normalizeEmail(contact.email);
    if (contact.phone) params.phone = contact.phone;
    return params;
  }

  /** Create customer in Stripe, link to user, return. */
  private async createAndLinkCustomer(
    userId: string,
    contact: UserContact,
  ): Promise<StripeCustomer> {
    const params = this.buildStripeCustomerParams(userId, contact);
    const customer = await this.createCustomer(userId, params as CustomerCreateParams);
    return customer;
  }

  async createCustomer(
    userId: string,
    customerInput: CustomerCreateParams,
  ): Promise<StripeResponse<StripeCustomer>> {
    try {
      const params: Stripe.CustomerCreateParams = {};
      if (customerInput.metadata) params.metadata = customerInput.metadata;
      if (customerInput.email) params.email = customerInput.email;
      if (customerInput.phone) params.phone = customerInput.phone;
      if (customerInput.name) params.name = customerInput.name;
      const newCustomer = await stripe.customers.create(params);
      await this.linkStripeCustomerToUser(userId, newCustomer.id);
      logger.info("Stripe customer created", { userId, stripeCustomerId: newCustomer.id });
      return newCustomer;
    } catch (error) {
      if (error instanceof Error) {
        throw new InvalidPaymentRequestError(error);
      }
      throw error;
    }
  }

  async retrieveCustomer(customerId: string) {
    try {
      const customer = await stripe.customers.retrieve(customerId);

      if (customer.deleted) {
        logger.warn(`This customer with id: ${customerId} is deleted`);
      }

      return customer;
    } catch (error) {
      if (error instanceof Error) {
        throw new CustomerNotFoundError(error);
      }

      throw error;
    }
  }

  async createCustomerSession(customerId: string): Promise<{ client_secret: string }> {
    const session = await stripe.customerSessions.create({
      customer: customerId,
      components: {
        payment_element: { enabled: true },
      },
    });
    return { client_secret: session.client_secret };
  }

  async createPayment(params: PaymentIntentCreateParams) {
    try {
      const paymentIntent = await stripe.paymentIntents.create(params);

      logger.info("Payment intent created", {
        paymentIntentId: paymentIntent.id,
        amount: paymentIntent.amount,
        customerId: paymentIntent.customer,
      });

      return paymentIntent;
    } catch (error) {
      if (error instanceof Error) {
        throw new InvalidPaymentRequestError(error);
      } else throw error;
    }
  }

  async confirmPayment(paymentIntentId: string) {
    try {
      const paymentIntent = await stripe.paymentIntents.confirm(paymentIntentId);
      logger.info("Payment confirmed", { paymentIntentId });
      return paymentIntent;
    } catch (error) {
      if (error instanceof Error) {
        throw new PaymentConfirmError("Failed to confirm payment", error);
      }
      throw error;
    }
  }

  async createRefund(paymentIntentId: string): Promise<Stripe.Refund> {
    try {
      const refund = await stripe.refunds.create({
        payment_intent: paymentIntentId,
      });
      logger.info("Refund created", {
        refundId: refund.id,
        paymentIntentId,
        amount: refund.amount,
      });
      return refund;
    } catch (error) {
      if (error instanceof Error) {
        throw new InvalidPaymentRequestError(error);
      }
      throw error;
    }
  }
}
export const paymentService = new PaymentService(db);
