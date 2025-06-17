import React, { useEffect, useState } from "react";
import { getDashboard } from "./api";

export default function Dashboard() {
  const [services, setServices] = useState<{name: string; id: string; password: string;}[]>([]);

  useEffect(() => {
    getDashboard().then(data => setServices(data.services)).catch(() => {});
  }, []);

  return (
    <div>
      <h1 className="text-xl font-bold mb-4">Active Services</h1>
      <ul className="space-y-2">
        {services.map(s => (
          <li key={s.name} className="border p-2">
            <div>{s.name}</div>
            <div>ID: {s.id}</div>
            <div>Password: {s.password}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}
