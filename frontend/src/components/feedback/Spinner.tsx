import React from "react";

type Props = {
  size?: number;
  className?: string;
};

export default function Spinner({ size = 24, className = "" }: Props) {
  const dim = `${size}px`;
  return (
    <svg
      className={`animate-spin text-blue-600 ${className}`}
      style={{ width: dim, height: dim }}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Loading"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}

