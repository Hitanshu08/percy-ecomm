import React from "react";
import Signup from "./Signup";
import Login from "./Login";

export default function App() {
  return (
    <div className="p-4">
      <Signup />
      <hr className="my-4" />
      <Login />
    </div>
  );
}
