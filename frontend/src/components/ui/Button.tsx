import React from "react";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md" | "lg";
};

const base = "inline-flex items-center justify-center rounded-md font-medium focus:outline-none focus:ring-2 disabled:opacity-50 disabled:cursor-not-allowed transition";

const variants: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary: "relative overflow-hidden border border-blue-300/45 dark:border-blue-400/30 bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-600 text-white shadow-[0_10px_24px_rgba(37,99,235,0.35)] hover:brightness-105 hover:shadow-[0_12px_28px_rgba(37,99,235,0.45)] active:translate-y-px focus:ring-blue-300",
  secondary: "glass-btn-secondary text-gray-900 dark:text-slate-100 hover:bg-white/70 dark:hover:bg-slate-800/60 focus:ring-blue-300",
  ghost: "bg-transparent text-gray-900 dark:text-slate-100 hover:bg-white/55 dark:hover:bg-slate-800/40 focus:ring-blue-200",
};

const sizes: Record<NonNullable<ButtonProps["size"]>, string> = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-4 py-2 text-sm",
  lg: "px-5 py-2.5 text-base",
};

export default function Button({
  variant = "primary",
  size = "md",
  className = "",
  ...props
}: ButtonProps) {
  const cls = `${base} ${variants[variant]} ${sizes[size]} ${className}`.trim();
  return <button className={cls} {...props} />;
}

