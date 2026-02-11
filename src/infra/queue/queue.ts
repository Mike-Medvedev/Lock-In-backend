import { Queue } from "bullmq";
export const verificationQueue = new Queue("verification_queue", {
  connection: {
    host: "localhost",
    port: 6379,
  },
});
