const API_URL = "http://localhost:8000";

function authHeaders() {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function signup(username: string, password: string, userId: string) {
  const res = await fetch(`${API_URL}/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password, user_id: userId }),
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

export async function getMe() {
  const res = await fetch(`${API_URL}/me`, { headers: { ...authHeaders() } });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getNotifications() {
  const res = await fetch(`${API_URL}/notifications`, { headers: { ...authHeaders() } });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function adminAddSubscription(username: string, service: string) {
  const res = await fetch(`${API_URL}/admin/add-subscription`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ username, service_name: service })
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function adminUpdateService(service: string, id: string, password: string) {
  const res = await fetch(`${API_URL}/admin/update-service`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ service_name: service, new_id: id, new_password: password })
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
