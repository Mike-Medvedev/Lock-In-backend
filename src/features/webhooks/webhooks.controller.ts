import type { Request, Response } from "express";
import { webhookService } from "@/features/webhooks/webhooks.service";

export const WebhookController = {
  async handleStripeEvent(req: Request, res: Response): Promise<void> {
    const event = webhookService.verifyAndParse(req);
    await webhookService.handleEvent(event);
    res.sendStatus(200);
  },
};
