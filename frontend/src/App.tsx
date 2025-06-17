import React from "react";
import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import Signup from "./Signup";
import Login from "./Login";
import Dashboard from "./Dashboard";
import UserPage from "./UserPage";
import Wallet from "./Wallet";
import Shop from "./Shop";
import ContactUs from "./ContactUs";
import Subscriptions from "./Subscriptions";

export default function App() {
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
        </Routes>
      </div>
    </BrowserRouter>
  );
}
