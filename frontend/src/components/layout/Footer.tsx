import React from "react";
import { useTheme } from "../../contexts/ThemeContext";

export default function Footer() {
  const { theme } = useTheme();
  return (
      <footer className="mx-4 sm:mx-8 lg:mx-12 mt-12 mb-6 py-5 px-4 sm:px-6 rounded-2xl glass-panel-soft border border-white/40 dark:border-slate-500/30">
        <div className={`text-sm flex justify-between ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
          <span>© {new Date().getFullYear()} ValueSubs</span>
          <a href="/terms" className="hover:underline">Terms & Conditions</a>
        </div>
      </footer>
  );
}
