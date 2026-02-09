import { db, type DB } from "@/infra/db/db.ts";
import { gpsSamples, motionSamples, pedometerSamples } from "@/infra/db/schema.ts";
import { eq } from "drizzle-orm";
import type {
  BatchSamplesResponse,
  CreateGpsSample,
  CreateMotionSample,
  CreatePedometerSample,
  GpsSample,
  MotionSample,
  PedometerSample,
} from "./session-sample.model.ts";
import { GpsSampleModel, MotionSampleModel, PedometerSampleModel } from "./session-sample.model.ts";

class SessionSampleService {
  constructor(private readonly _db: DB) {}

  /**
   * Batch-insert motion, GPS, and pedometer samples for a session.
   * Called periodically by the frontend while a session is in progress.
   */
  async ingestSamples(
    commitmentSessionId: string,
    motionData: CreateMotionSample[],
    gpsData: CreateGpsSample[],
    pedometerData: CreatePedometerSample[],
  ): Promise<BatchSamplesResponse> {
    let motionInserted = 0;
    let gpsInserted = 0;
    let pedometerInserted = 0;

    if (motionData.length > 0) {
      const rows = motionData.map((s) => ({
        ...s,
        commitmentSessionId,
      }));
      const result = await this._db.insert(motionSamples).values(rows).returning();
      motionInserted = result.length;
    }

    if (gpsData.length > 0) {
      const rows = gpsData.map((s) => ({
        ...s,
        commitmentSessionId,
      }));
      const result = await this._db.insert(gpsSamples).values(rows).returning();
      gpsInserted = result.length;
    }

    if (pedometerData.length > 0) {
      const rows = pedometerData.map((s) => ({
        ...s,
        commitmentSessionId,
      }));
      const result = await this._db.insert(pedometerSamples).values(rows).returning();
      pedometerInserted = result.length;
    }

    return {
      motionSamplesInserted: motionInserted,
      gpsSamplesInserted: gpsInserted,
      pedometerSamplesInserted: pedometerInserted,
    };
  }

  /** Retrieve all motion samples for a given session. */
  async getMotionSamples(commitmentSessionId: string): Promise<MotionSample[]> {
    const rows = await this._db
      .select()
      .from(motionSamples)
      .where(eq(motionSamples.commitmentSessionId, commitmentSessionId));
    return rows.map((r) => MotionSampleModel.parse(r));
  }

  /** Retrieve all GPS samples for a given session. */
  async getGpsSamples(commitmentSessionId: string): Promise<GpsSample[]> {
    const rows = await this._db
      .select()
      .from(gpsSamples)
      .where(eq(gpsSamples.commitmentSessionId, commitmentSessionId));
    return rows.map((r) => GpsSampleModel.parse(r));
  }

  /** Retrieve all pedometer samples for a given session. */
  async getPedometerSamples(commitmentSessionId: string): Promise<PedometerSample[]> {
    const rows = await this._db
      .select()
      .from(pedometerSamples)
      .where(eq(pedometerSamples.commitmentSessionId, commitmentSessionId));
    return rows.map((r) => PedometerSampleModel.parse(r));
  }
}

export const sessionSampleService = new SessionSampleService(db);
