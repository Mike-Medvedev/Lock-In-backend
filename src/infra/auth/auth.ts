import { AuthInvalidTokenResponseError, createClient, type User } from "@supabase/supabase-js";
import { env } from "@/infra/env";

// Create a single supabase client for interacting with your database
const supabase = createClient(env.SUPABASE_PROJECT_URL, env.SUPABASE_PUBLISHABLE_KEY);

export async function verifyUser(jwt: string): Promise<User> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(jwt);
  if (error || !user) throw error ?? new AuthInvalidTokenResponseError();
  return user;
}
