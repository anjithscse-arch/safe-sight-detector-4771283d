import { supabase } from "./supabase";
import type { User as SupabaseUser } from "@supabase/supabase-js";

export interface User {
  username: string;
  email: string;
}

function toUser(sbUser: SupabaseUser): User {
  return {
    username: sbUser.user_metadata?.username || sbUser.email?.split("@")[0] || "User",
    email: sbUser.email || "",
  };
}

export async function register(
  username: string,
  email: string,
  password: string
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { username } },
  });
  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function login(
  email: string,
  password: string
): Promise<{ success: boolean; user?: User; error?: string }> {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { success: false, error: error.message };
  return { success: true, user: toUser(data.user) };
}

export async function logout() {
  await supabase.auth.signOut();
}

export async function getCurrentUser(): Promise<User | null> {
  const { data } = await supabase.auth.getSession();
  if (!data.session?.user) return null;
  return toUser(data.session.user);
}
