import React from "react";

type Props = {
  balance: number;
  currency?: string;
};

export default function WalletCard({ balance, currency = "USD" }: Props) {
  return (
    <div className="rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-5">
      <div className="text-sm opacity-80">Balance</div>
      <div className="mt-1 text-3xl font-bold">{currency} {balance.toFixed(2)}</div>
    </div>
  );
}

