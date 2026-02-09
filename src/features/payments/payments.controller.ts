import type { Request, Response, NextFunction } from "express";
import { paymentService } from "@/features/payments/payments.service";
import { config } from "@/infra/config/config";
import { MissingPaymentSecretError } from "@/shared/errors";

export const PaymentsController = {
  async createPayment(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const body = req.body;

      const customer = await paymentService.getOrCreateCustomer(userId);

      const paymentIntent = await paymentService.createPayment({
        amount: body.amount,
        currency: body.currency,
        customer: customer.id,
        payment_method: body.paymentMethodId,
        automatic_payment_methods: { enabled: true, allow_redirects: "never" },
      });

      if (!paymentIntent.client_secret) {
        throw new MissingPaymentSecretError(
          `Payment Intent ${paymentIntent.id} missing client_secret — cannot complete payment`,
        );
      }

      const { client_secret: customerSessionClientSecret } =
        await paymentService.createCustomerSession(customer.id);

      if (!customerSessionClientSecret) {
        throw new MissingPaymentSecretError(
          `Customer Session missing client_secret for customer ${customer.id}`,
        );
      }

      res.success({
        paymentIntentId: paymentIntent.id,
        clientSecret: paymentIntent.client_secret,
        customerSessionClientSecret,
        customerId: customer.id,
        publishableKey: config.STRIPE_PUBLISHABLE_KEY,
      });
    } catch (error) {
      next(error);
    }
  },
  async confirmPayment(req: Request, res: Response, next: NextFunction) {
    try {
      const { paymentIntentId } = req.body;
      const paymentIntent = await paymentService.confirmPayment(paymentIntentId);
      res.success({ status: paymentIntent.status });
    } catch (error) {
      next(error);
    }
  },
  async createCustomer() {},
  async retrieveCustomer() {},
};
