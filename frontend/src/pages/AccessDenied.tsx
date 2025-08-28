import React from "react";
import { Link } from "react-router-dom";

export default function AccessDenied() {
  return (
    <div className="flex-1 max-w-sm mx-auto">
      <h1 className="text-xl font-bold mb-4">Access Denied</h1>
      <p>You do not have permission to view this page.</p>
      <p>
        <Link to="/" className="text-blue-500 underline">Return home</Link>
      </p>
    </div>
  );
}
