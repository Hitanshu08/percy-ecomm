import React from "react";

export default function Shop() {
  const services = [
    { name: "Quillbot" },
    { name: "Grammarly" }
  ];
  return (
    <div className="max-w-sm mx-auto">
      <h1 className="text-xl font-bold mb-4">Shop</h1>
      <ul className="space-y-2">
        {services.map(s => (
          <li key={s.name} className="border p-2">{s.name}</li>
        ))}
      </ul>
    </div>
  );
}
