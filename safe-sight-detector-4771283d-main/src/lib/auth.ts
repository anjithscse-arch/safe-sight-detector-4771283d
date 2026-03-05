export interface User {
  username: string;
  email: string;
}

const CURRENT_USER_KEY = "deepfake_current_user";

export async function register(
  username: string,
  email: string,
  password: string
): Promise<{ success: boolean; error?: string }> {
  console.log("Register handled by backend API later", {
    username,
    email,
    passwordLength: password.length,
  });
  return { success: true };
}

export async function login(
  email: string,
  password: string
): Promise<{ success: boolean; user?: User; error?: string }> {
  console.log("Login handled by backend API later", {
    email,
    passwordLength: password.length,
  });

  const user: User = {
    username: email.split("@")[0] || "User",
    email,
  };
  localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
  return { success: true, user };
}

export async function logout() {
  localStorage.removeItem(CURRENT_USER_KEY);
}

export async function getCurrentUser(): Promise<User | null> {
  const raw = localStorage.getItem(CURRENT_USER_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as User;
  } catch {
    localStorage.removeItem(CURRENT_USER_KEY);
    return null;
  }
}
