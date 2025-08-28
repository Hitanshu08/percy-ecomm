import React from "react";

type Props = {
  size?: number;
  className?: string;
};

export default function Spinner({ className = "" }: Props) {
  return (
    <div className={`bg-gray-50 dark:bg-gray-900 flex flex-1 items-center justify-center ${className}`}>
      <div className="animate-spin rounded-full h-20 w-20 border-b-4 border-blue-600"></div>
    </div>
  );
}

