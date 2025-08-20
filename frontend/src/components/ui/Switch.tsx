import React from "react";

type SwitchProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
  className?: string;
};

export default function Switch({ checked, onChange, label, disabled, className = "" }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${checked ? "bg-blue-600" : "bg-gray-300"} ${disabled ? "opacity-50 cursor-not-allowed" : ""} ${className}`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${checked ? "translate-x-6" : "translate-x-1"}`}
      />
      {label ? <span className="ml-2 text-sm text-gray-700">{label}</span> : null}
    </button>
  );
}

