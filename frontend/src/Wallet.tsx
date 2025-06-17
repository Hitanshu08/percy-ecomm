import React, { useEffect, useState } from "react";
import { getWallet, deposit } from "./api";

export default function Wallet() {
  const [credits, setCredits] = useState(0);
  const [amount, setAmount] = useState("");
  const [address, setAddress] = useState("");

  useEffect(() => {
    getWallet().then(w => {
      setCredits(w.credits);
      setAddress(w.btc_address);
    }).catch(() => {});
  }, []);

  const handle = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const data = await deposit(Number(amount));
      setCredits(data.credits);
      setAmount("");
    } catch {
      alert("Failed to deposit");
    }
  };

  return (
    <div className="max-w-sm mx-auto">
      <h1 className="text-xl font-bold mb-4">Wallet</h1>
      <p className="mb-2">Credits: {credits}</p>
      <p className="mb-4">Bitcoin address: {address}</p>
      <form onSubmit={handle} className="space-y-2">
        <input className="border p-2 w-full" placeholder="Amount" value={amount} onChange={e => setAmount(e.target.value)} />
        <button className="bg-blue-500 text-white py-2 px-4 rounded">Deposit</button>
      </form>
    </div>
  );
}
