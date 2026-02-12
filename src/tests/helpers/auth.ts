import supertest from "supertest";
import app from "@/app";
import { supabase } from "@/infra/auth/auth";
import { config } from "@/infra/config/config";

/**
 * Sign in with the test user and return an authenticated supertest agent + userId.
 * Use in `beforeAll` to avoid duplicating auth setup across test files.
 */
export async function getTestAuth(): Promise<{ auth: supertest.Agent; userId: string }> {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: config.TEST_USER_EMAIL,
    password: config.TEST_USER_PASSWORD,
  });

  if (error || !data.session || !data.user) {
    throw new Error(`Test auth failed: ${error?.message ?? "no session"}`);
  }

  const auth = supertest.agent(app).set("Authorization", `Bearer ${data.session.access_token}`);
  return { auth, userId: data.user.id };
}

/** Unauthenticated supertest instance for testing 401 responses. */
export function getUnauthenticatedRequest() {
  return supertest(app);
}
