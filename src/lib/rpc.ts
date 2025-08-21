import { createClient } from "@supabase/supabase-js";

export const rpcSupabase = (() => {
  const url = import.meta.env.VITE_SUPABASE_URL as string;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
  return createClient(url, key);
})();

export async function rpc<T>(fn: string, args: Record<string, unknown>) {
  const { data, error } = await rpcSupabase.rpc<T>(fn, args);
  if (error) throw error;
  return data as T;
}

export async function getCurrentUserId(): Promise<string | null> {
  const { data: { user } } = await rpcSupabase.auth.getUser();
  return user?.id ?? null;
}

