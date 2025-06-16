const API_URL = "http://localhost:8000";

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
