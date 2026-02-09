import Stripe from "stripe";
import { config } from "@/infra/config/config";

const stripe = new Stripe(config.STRIPE_API_KEY);
export default stripe;
