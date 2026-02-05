import express from "express";

const CommitmentSessionsRouter = express.Router();

CommitmentSessionsRouter.get("/", (_req, res) => {
  res.json({ data: 0 });
});

export default CommitmentSessionsRouter;
