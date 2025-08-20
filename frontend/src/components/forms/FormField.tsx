import React from "react";

type Props = {
  label?: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
};

export default function FormField({ label, hint, error, children }: Props) {
  return (
    <div className="space-y-1">
      {label ? <label className="block text-sm font-medium text-gray-700">{label}</label> : null}
      {children}
      {hint ? <p className="text-xs text-gray-500">{hint}</p> : null}
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}

