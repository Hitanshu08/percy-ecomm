import React from "react";

type Props = {
  count?: number;
  onClick?: () => void;
};

export default function NotificationBell({ count = 0, onClick }: Props) {
  return (
    <button onClick={onClick} className="relative text-gray-700 hover:text-gray-900">
      🔔
      {count > 0 && (
        <span className="absolute -top-1 -right-1 h-4 min-w-[16px] px-1 rounded-full bg-red-600 text-white text-[10px] leading-4 text-center">
          {count}
        </span>
      )}
    </button>
  );
}

