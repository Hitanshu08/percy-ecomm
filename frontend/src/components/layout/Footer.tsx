import React from "react";
import { useTheme } from "../../contexts/ThemeContext";

export default function Footer() {
  const { theme } = useTheme();
  return (
      <footer className={`mx-12 mt-16 py-8 border-t border-gray-200 dark:border-gray-700 ${theme === 'dark' ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-900'}`}>
        <div className={`text-sm flex justify-between ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
          <span>© {new Date().getFullYear()} ValueSubs</span>
          <a href="/terms" className="hover:underline">Terms & Conditions</a>
        </div>
      </footer>
  );
}
