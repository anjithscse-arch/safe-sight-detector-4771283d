export interface User {
  username: string;
  email: string;
}

interface StoredUser {
  username: string;
  email: string;
  passwordHash: string;
}

// Simple hash for demo purposes (not cryptographically secure)
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return hash.toString(36);
}

function getUsers(): StoredUser[] {
  const data = localStorage.getItem("deepfake_users");
  return data ? JSON.parse(data) : [];
}

function saveUsers(users: StoredUser[]) {
  localStorage.setItem("deepfake_users", JSON.stringify(users));
}

export function register(username: string, email: string, password: string): { success: boolean; error?: string } {
  const users = getUsers();
  if (users.find(u => u.email === email)) {
    return { success: false, error: "An account with this email already exists." };
  }
  if (users.find(u => u.username === username)) {
    return { success: false, error: "This username is already taken." };
  }
  users.push({ username, email, passwordHash: simpleHash(password) });
  saveUsers(users);
  return { success: true };
}

export function login(email: string, password: string): { success: boolean; user?: User; error?: string } {
  const users = getUsers();
  const user = users.find(u => u.email === email);
  if (!user) return { success: false, error: "No account found with this email." };
  if (user.passwordHash !== simpleHash(password)) return { success: false, error: "Incorrect password." };
  const sessionUser: User = { username: user.username, email: user.email };
  localStorage.setItem("deepfake_session", JSON.stringify(sessionUser));
  return { success: true, user: sessionUser };
}

export function logout() {
  localStorage.removeItem("deepfake_session");
}

export function getCurrentUser(): User | null {
  const data = localStorage.getItem("deepfake_session");
  return data ? JSON.parse(data) : null;
}
