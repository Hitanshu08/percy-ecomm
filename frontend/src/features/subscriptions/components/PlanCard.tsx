import React from "react";

type Props = {
  name: string;
  pricePerMonth: number;
  features?: string[];
  onSelect?: () => void;
};

export default function PlanCard({ name, pricePerMonth, features = [], onSelect }: Props) {
  return (
    <div className="border rounded-lg p-4 bg-white">
      <div className="text-lg font-semibold">{name}</div>
      <div className="mt-1 text-2xl font-bold">${pricePerMonth}/mo</div>
      <ul className="mt-3 space-y-1 text-sm text-gray-700">
        {features.map((f) => (
          <li key={f}>• {f}</li>
        ))}
      </ul>
      <button className="mt-4 w-full bg-blue-600 text-white rounded-md py-2" onClick={onSelect}>Choose</button>
    </div>
  );
}

