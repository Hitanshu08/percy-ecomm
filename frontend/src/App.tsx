import React, { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import Signup from "./Signup";
import Login from "./Login";
import Dashboard from "./Dashboard";
import UserPage from "./UserPage";
import Wallet from "./Wallet";
import Shop from "./Shop";
import ContactUs from "./ContactUs";
import Subscriptions from "./Subscriptions";
import Admin from "./Admin";
import Notifications from "./Notifications";
import { getMe } from "./api";

export default function App() {
  const [role, setRole] = useState("");

  useEffect(() => {
    getMe().then(u => setRole(u.role)).catch(() => {});
  }, []);

  return (
    <BrowserRouter>
      <nav className="p-4 space-x-2 bg-gray-100">
        <Link to="/">Auth</Link>
        <Link to="/dashboard">Dashboard</Link>
        <Link to="/user">User</Link>
        <Link to="/wallet">Wallet</Link>
        <Link to="/shop">Shop</Link>
        <Link to="/subscriptions">Subscriptions</Link>
        <Link to="/contact">Contact Us</Link>
        <Link to="/notifications">Notifications</Link>
        {role === "admin" && <Link to="/admin">Admin</Link>}
      </nav>
      <div className="p-4">
        <Routes>
          <Route path="/" element={<><Signup /><hr className="my-4" /><Login /></>} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/user" element={<UserPage />} />
          <Route path="/wallet" element={<Wallet />} />
          <Route path="/shop" element={<Shop />} />
          <Route path="/subscriptions" element={<Subscriptions />} />
          <Route path="/contact" element={<ContactUs />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/admin" element={<Admin />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}
