import React from "react";
import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="flex-1 max-w-sm mx-auto">
      <div className="glass-panel rounded-2xl border border-white/40 dark:border-slate-500/30 p-6">
        <h1 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">404 - Page Not Found</h1>
        <p className="text-gray-700 dark:text-gray-300">
          The page you are looking for does not exist.{' '}
          <Link to="/" className="text-blue-500 underline">Go home</Link>
          .
        </p>
      </div>
    </div>
  );
}
