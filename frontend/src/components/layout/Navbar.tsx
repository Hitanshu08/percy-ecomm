import React from "react";
import { Link } from "react-router-dom";

export default function Navbar() {
  return (
    <nav className="border-b bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <Link to="/dashboard" className="text-lg font-semibold">ValueSubs</Link>
        <div className="hidden md:flex items-center space-x-6">
          <Link to="/dashboard" className="text-sm text-gray-700 hover:text-gray-900">Dashboard</Link>
          <Link to="/shop" className="text-sm text-gray-700 hover:text-gray-900">Shop</Link>
          <Link to="/subscriptions" className="text-sm text-gray-700 hover:text-gray-900">Subscriptions</Link>
          <Link to="/wallet" className="text-sm text-gray-700 hover:text-gray-900">Wallet</Link>
          <Link to="/contact" className="text-sm text-gray-700 hover:text-gray-900">Contact</Link>
        </div>
      </div>
    </nav>
  );
}

