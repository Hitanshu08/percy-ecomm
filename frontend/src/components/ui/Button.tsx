import React from "react";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md" | "lg";
};

const base = "inline-flex items-center justify-center rounded-md font-medium focus:outline-none focus:ring-2 disabled:opacity-50 disabled:cursor-not-allowed transition";

const variants: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary: "bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-400",
  secondary: "bg-gray-200 text-gray-900 hover:bg-gray-300 focus:ring-gray-300",
  ghost: "bg-transparent hover:bg-gray-100 text-gray-900 focus:ring-gray-200",
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

