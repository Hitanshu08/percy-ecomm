import React from "react";

type Props = {
  size?: number;
  className?: string;
};

export default function Spinner({ className = "" }: Props) {
  return (
    <div className={`min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center ${className}`}>
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
    </div>
  );
}

