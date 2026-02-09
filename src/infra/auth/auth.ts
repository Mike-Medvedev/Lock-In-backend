import { AuthInvalidTokenResponseError, createClient, type User } from "@supabase/supabase-js";
import { config } from "@/infra/config/config";

const supabase = createClient(config.SUPABASE_PROJECT_URL, config.SUPABASE_PUBLISHABLE_KEY);

export async function verifyUser(jwt: string): Promise<User> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(jwt);
  if (error || !user) throw error ?? new AuthInvalidTokenResponseError();
  return user;
}

const data = await supabase.auth.signInWithPassword({
  email: "mmedvedev20@gmail.com",
  password: "12345b67",
});

console.log(data);
