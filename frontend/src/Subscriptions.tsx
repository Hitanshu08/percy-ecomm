import React, { useEffect, useState } from "react";
import { getSubscriptions } from "./api";

export default function Subscriptions() {
  const [subs, setSubs] = useState<{name: string;}[]>([]);

  useEffect(() => {
    getSubscriptions().then(data => setSubs(data.subscriptions)).catch(() => {});
  }, []);

  return (
    <div>
      <h1 className="text-xl font-bold mb-4">Subscriptions</h1>
      <ul className="space-y-2">
        {subs.map(s => (
          <li key={s.name} className="border p-2">
            <div>{s.name}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}
