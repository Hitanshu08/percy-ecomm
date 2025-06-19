const API_URL = "http://localhost:8000";

function authHeaders() {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function handle(res: Response) {
  if (res.status === 401 || res.status === 403) {
    window.location.href = "/access-denied";
    throw new Error("access_denied");
  }
  if (!res.ok) {
    throw new Error(await res.text());
  }
  return res.json();
}

export async function signup(username: string, password: string, userId: string) {
  const res = await fetch(`${API_URL}/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password, user_id: userId }),
  });
  return handle(res);
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
  return handle(res);
}

export async function getDashboard() {
  const res = await fetch(`${API_URL}/dashboard`, {
    headers: { ...authHeaders() }
  });
  return handle(res);
}

export async function changePassword(oldPass: string, newPass: string) {
  const res = await fetch(`${API_URL}/change-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ old_password: oldPass, new_password: newPass })
  });
  return handle(res);
}

export async function getWallet() {
  const res = await fetch(`${API_URL}/wallet`, { headers: { ...authHeaders() } });
  return handle(res);
}

export async function deposit(amount: number) {
  const res = await fetch(`${API_URL}/wallet/deposit`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ amount })
  });
  return handle(res);
}

export async function getSubscriptions() {
  const res = await fetch(`${API_URL}/subscriptions`, {
    headers: { ...authHeaders() }
  });
  return handle(res);
}

export async function getMe() {
  const res = await fetch(`${API_URL}/me`, { headers: { ...authHeaders() } });
  return handle(res);
}

export async function getNotifications() {
  const res = await fetch(`${API_URL}/notifications`, { headers: { ...authHeaders() } });
  return handle(res);
}

export async function adminAddSubscription(username: string, service: string) {
  const res = await fetch(`${API_URL}/admin/add-subscription`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ username, service_name: service })
  });
  return handle(res);
}

export async function adminUpdateService(service: string, id: string, password: string) {
  const res = await fetch(`${API_URL}/admin/update-service`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ service_name: service, new_id: id, new_password: password })
  });
  return handle(res);
}
