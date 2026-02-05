import express from "express";

const PoolRouter = express.Router();

PoolRouter.get("/", (_req, res) => {
  res.json({ data: 0 });
});

export default PoolRouter;
