import { supabase } from "./supabase";
import type { User as SupabaseUser } from "@supabase/supabase-js";

export interface User {
  username: string;
  email: string;
}

interface LocalUserRecord extends User {
  password_hash: string;
  password?: string;
}

const LOCAL_USERS_KEY = "deepfakeguard_local_users";
const LOCAL_SESSION_KEY = "deepfakeguard_local_session";
const NETWORK_ERROR_PATTERN = /fetch failed|failed to fetch|network/i;

function readLocalUsers(): LocalUserRecord[] {
  try {
    const raw = localStorage.getItem(LOCAL_USERS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as LocalUserRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocalUsers(users: LocalUserRecord[]) {
  localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(users));
}

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const digest = await crypto.subtle.digest("SHA-256", data);
  const bytes = Array.from(new Uint8Array(digest));
  return bytes.map((b) => b.toString(16).padStart(2, "0")).join("");
}

function setLocalSession(user: User | null) {
  if (!user) {
    localStorage.removeItem(LOCAL_SESSION_KEY);
  } else {
    localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(user));
  }
  window.dispatchEvent(new Event("auth-changed"));
}

function readLocalSession(): User | null {
  try {
    const raw = localStorage.getItem(LOCAL_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as User;
    if (!parsed?.email) return null;
    return parsed;
  } catch {
    return null;
  }
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
  try {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { username } },
    });
    if (!error) return { success: true };

    // Fallback to local auth when remote auth service is unreachable.
    if (!NETWORK_ERROR_PATTERN.test(error.message)) {
      return { success: false, error: error.message };
    }
  } catch {
    // Fallback to local auth below.
  }

  const users = readLocalUsers();
  if (users.some((u) => u.email.toLowerCase() === email.toLowerCase())) {
    return { success: false, error: "Email already exists." };
  }

  const password_hash = await hashPassword(password);
  users.push({ username, email, password_hash });
  writeLocalUsers(users);
  return { success: true };
}

export async function login(
  email: string,
  password: string
): Promise<{ success: boolean; user?: User; error?: string }> {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (!error) return { success: true, user: toUser(data.user) };

    if (!NETWORK_ERROR_PATTERN.test(error.message)) {
      return { success: false, error: error.message };
    }
  } catch {
    // Fallback to local auth below.
  }

  const users = readLocalUsers();
  const password_hash = await hashPassword(password);
  const match = users.find((u) => {
    if (u.email.toLowerCase() !== email.toLowerCase()) return false;
    return u.password_hash === password_hash || u.password === password;
  });
  if (!match) {
    return { success: false, error: "Invalid email or password." };
  }

  // Migrate any legacy plaintext local records to hashed storage.
  if (match.password) {
    match.password_hash = password_hash;
    delete match.password;
    writeLocalUsers(users);
  }

  const user: User = { username: match.username, email: match.email };
  setLocalSession(user);
  return { success: true, user };
}

export async function logout() {
  try {
    await supabase.auth.signOut();
  } catch {
    // Ignore remote logout errors and clear local session regardless.
  }
  setLocalSession(null);
}

export async function getCurrentUser(): Promise<User | null> {
  try {
    const { data } = await supabase.auth.getSession();
    if (data.session?.user) {
      return toUser(data.session.user);
    }
  } catch {
    // Fall back to local session.
  }

  return readLocalSession();
}
