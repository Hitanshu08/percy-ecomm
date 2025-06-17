const API_URL = "http://localhost:8000";

function authHeaders() {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function signup(username: string, password: string) {
  const res = await fetch(`${API_URL}/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) {
    throw new Error(await res.text());
  }
  return res.json();
}

export async function login(username: string, password: string) {
  const data = new URLSearchParams();
  data.append("username", username);
  data.append("password", password);
  const res = await fetch(`${API_URL}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: data.toString(),
  });
  if (!res.ok) {
    throw new Error(await res.text());
  }
  return res.json();
}

export async function getDashboard() {
  const res = await fetch(`${API_URL}/dashboard`, {
    headers: { ...authHeaders() }
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function changePassword(oldPass: string, newPass: string) {
  const res = await fetch(`${API_URL}/change-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ old_password: oldPass, new_password: newPass })
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getWallet() {
  const res = await fetch(`${API_URL}/wallet`, { headers: { ...authHeaders() } });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function deposit(amount: number) {
  const res = await fetch(`${API_URL}/wallet/deposit`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ amount })
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getSubscriptions() {
  const res = await fetch(`${API_URL}/subscriptions`, {
    headers: { ...authHeaders() }
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
