export interface User {
  username: string;
  email: string;
}

export async function getCurrentUser(): Promise<User | null> {
  try {
    const stored = localStorage.getItem("auth_user");
    if (!stored) return null;
    return JSON.parse(stored) as User;
  } catch {
    return null;
  }
}

export async function loginUser(email: string, password: string): Promise<User> {
  const response = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || "Login failed");
  }
  const user = await response.json();
  localStorage.setItem("auth_user", JSON.stringify(user));
  window.dispatchEvent(new Event("auth-changed"));
  return user;
}

export async function registerUser(email: string, password: string, username: string): Promise<User> {
  const response = await fetch("/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, username })
  });
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || "Registration failed");
  }
  const user = await response.json();
  localStorage.setItem("auth_user", JSON.stringify(user));
  window.dispatchEvent(new Event("auth-changed"));
  return user;
}

export async function logoutUser(): Promise<void> {
  localStorage.removeItem("auth_user");
  window.dispatchEvent(new Event("auth-changed"));
}
