import Stripe from "stripe";
import { config } from "@/infra/config/config";
import { CustomerNotFoundError, InvalidPaymentRequestError } from "@/shared/errors";
import logger from "@/infra/logger/logger";

export const stripe = new Stripe(config.STRIPE_API_KEY);

export async function createCustomer(
  customer: Stripe.CustomerCreateParams,
): Promise<Stripe.Response<Stripe.Customer>> {
  try {
    const newCustomer = await stripe.customers.create(customer);

    return newCustomer;
  } catch (error) {
    if (error instanceof Error) {
      throw new InvalidPaymentRequestError(error);
    }

    throw error;
  }
}

export async function retrieveCustomer(customerId: string) {
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
export async function createPayment(params: Stripe.PaymentIntentCreateParams) {
  try {
    const paymentIntent = await stripe.paymentIntents.create(params);
    console.log(paymentIntent);

    return paymentIntent;
  } catch (error) {
    if (error instanceof Error) {
      throw new InvalidPaymentRequestError(error);
    } else throw error;
  }
}

export async function confirmPayment(paymentIntentId: string) {
  const confirmation = await stripe.paymentIntents.confirm(paymentIntentId);
  console.log(confirmation);
}

// await createPayment({
//   amount: 2000,
//   currency: "usd",
//   payment_method: "pm_card_us",
//   automatic_payment_methods: {
//     allow_redirects: "never",
//     enabled: true,
//   },
//   confirm: true,
// });

// await confirmPayment("pi_3Syvz38MGFyiBiKN0aezecxa");
