import React from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";

export default function UserMenu() {
  const { user, logout } = useAuth();

  return (
    <div className="flex items-center space-x-3">
      <span className="hidden sm:inline text-sm text-gray-700">{user?.email}</span>
      <Link to="/profile" className="text-sm text-blue-600 hover:underline">Profile</Link>
      <button onClick={logout} className="text-sm text-gray-600 hover:text-gray-900">Logout</button>
    </div>
  );
}

