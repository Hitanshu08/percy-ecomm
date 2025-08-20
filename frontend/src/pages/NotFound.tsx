import React from "react";
import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="max-w-sm mx-auto">
      <h1 className="text-xl font-bold mb-4">404 - Page Not Found</h1>
      <p>
        The page you are looking for does not exist.{' '}
        <Link to="/" className="text-blue-500 underline">Go home</Link>
        .
      </p>
    </div>
  );
}
