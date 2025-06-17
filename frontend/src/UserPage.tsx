import React, { useState } from "react";
import { changePassword } from "./api";

export default function UserPage() {
  const [oldPassword, setOld] = useState("");
  const [newPassword, setNew] = useState("");
  const [msg, setMsg] = useState("");

  const handle = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await changePassword(oldPassword, newPassword);
      setMsg("Password updated");
    } catch {
      alert("Failed to change password");
    }
  };

  return (
    <div className="max-w-sm mx-auto">
      <h1 className="text-xl font-bold mb-4">User</h1>
      <form onSubmit={handle} className="space-y-2">
        <input className="border p-2 w-full" type="password" placeholder="Old password" value={oldPassword} onChange={e => setOld(e.target.value)} />
        <input className="border p-2 w-full" type="password" placeholder="New password" value={newPassword} onChange={e => setNew(e.target.value)} />
        <button className="bg-blue-500 text-white py-2 px-4 rounded">Change Password</button>
      </form>
      {msg && <p className="mt-4">{msg}</p>}
    </div>
  );
}
