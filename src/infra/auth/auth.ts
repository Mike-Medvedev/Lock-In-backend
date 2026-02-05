import { AuthInvalidTokenResponseError, createClient, type User } from "@supabase/supabase-js";
import { config } from "@/infra/config/config";

// Create a single supabase client for interacting with your database
const supabase = createClient(config.SUPABASE_PROJECT_URL, config.SUPABASE_PUBLISHABLE_KEY);

export async function verifyUser(jwt: string): Promise<User> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(jwt);
  if (error || !user) throw error ?? new AuthInvalidTokenResponseError();
  return user;
}
