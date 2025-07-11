import React, { useState } from "react";
import { signup } from "./api";

export default function Signup() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [userId, setUserId] = useState("");
  const [message, setMessage] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await signup(username, password, userId);
      setMessage("User created, please login.");
      setSuggestions([]);
    } catch (err: any) {
      const msg = String(err.message || err);
      if (msg.startsWith("user_id_exists")) {
        setSuggestions(msg.split(":")[1].split(","));
      } else {
        alert("Failed to sign up");
      }
    }
  };

  return (
    <div className="max-w-sm mx-auto">
      <h1 className="text-xl font-bold mb-4">Signup</h1>
      <form onSubmit={handleSubmit} className="space-y-2">
        <input className="border p-2 w-full" placeholder="Username" value={username} onChange={e => setUsername(e.target.value)} />
        <input className="border p-2 w-full" placeholder="User ID" value={userId} onChange={e => setUserId(e.target.value)} />
        <input className="border p-2 w-full" type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} />
        <button className="bg-blue-500 text-white py-2 px-4 rounded">Signup</button>
      </form>
      {message && <p className="mt-4">{message}</p>}
      {suggestions.length > 0 && (
        <div className="mt-2">Suggested IDs: {suggestions.join(", ")}</div>
      )}
    </div>
  );
}
