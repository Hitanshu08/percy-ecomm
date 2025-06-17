import React, { useEffect, useState } from "react";
import { getNotifications } from "./api";

export default function Notifications() {
  const [notes, setNotes] = useState<string[]>([]);

  useEffect(() => {
    getNotifications().then(n => setNotes(n.notifications)).catch(() => {});
  }, []);

  return (
    <div>
      <h1 className="text-xl font-bold mb-4">Notifications</h1>
      <ul className="space-y-2">
        {notes.map((n, i) => (
          <li key={i} className="border p-2">{n}</li>
        ))}
      </ul>
    </div>
  );
}
