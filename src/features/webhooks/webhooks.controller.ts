import type { Request, Response } from "express";
import { webhookService } from "./webhooks.service";

export const WebhookController = {
  async handleStripeEvent(req: Request, res: Response): Promise<void> {
    await webhookService.handleWebhook(req);
    res.sendStatus(200);
  },
};
