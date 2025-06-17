import React, { useState } from "react";
import { adminAddSubscription, adminUpdateService } from "./api";

export default function Admin() {
  const [username, setUsername] = useState("");
  const [service, setService] = useState("");
  const [svcId, setSvcId] = useState("");
  const [svcPass, setSvcPass] = useState("");
  const [msg, setMsg] = useState("");

  const addSub = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await adminAddSubscription(username, service);
      setMsg("Subscription added");
    } catch {
      alert("Failed");
    }
  };

  const updateSvc = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await adminUpdateService(service, svcId, svcPass);
      setMsg("Service updated");
    } catch {
      alert("Failed");
    }
  };

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Admin</h1>
      <form onSubmit={addSub} className="space-y-2">
        <div>Add Subscription</div>
        <input className="border p-2 w-full" placeholder="Username" value={username} onChange={e => setUsername(e.target.value)} />
        <input className="border p-2 w-full" placeholder="Service" value={service} onChange={e => setService(e.target.value)} />
        <button className="bg-blue-500 text-white py-1 px-3 rounded">Add</button>
      </form>
      <form onSubmit={updateSvc} className="space-y-2">
        <div>Update Service Credentials</div>
        <input className="border p-2 w-full" placeholder="Service" value={service} onChange={e => setService(e.target.value)} />
        <input className="border p-2 w-full" placeholder="New ID" value={svcId} onChange={e => setSvcId(e.target.value)} />
        <input className="border p-2 w-full" placeholder="New Password" value={svcPass} onChange={e => setSvcPass(e.target.value)} />
        <button className="bg-blue-500 text-white py-1 px-3 rounded">Update</button>
      </form>
      {msg && <div>{msg}</div>}
    </div>
  );
}
