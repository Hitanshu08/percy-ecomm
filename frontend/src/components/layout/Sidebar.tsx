import React from "react";
import { NavLink } from "react-router-dom";

export default function Sidebar() {
  const links = [
    { to: "/dashboard", label: "Dashboard" },
    { to: "/shop", label: "Shop" },
    { to: "/subscriptions", label: "Subscriptions" },
    { to: "/wallet", label: "Wallet" },
    { to: "/contact", label: "Contact" },
  ];

  return (
    <aside className="hidden lg:block w-64 border-r bg-white">
      <nav className="p-4 space-y-1">
        {links.map((l) => (
          <NavLink
            key={l.to}
            to={l.to}
            className={({ isActive }) =>
              `block rounded px-3 py-2 text-sm ${isActive ? "bg-blue-50 text-blue-700" : "text-gray-700 hover:bg-gray-50"}`
            }
          >
            {l.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}

