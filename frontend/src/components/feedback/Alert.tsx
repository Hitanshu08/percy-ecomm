import React from "react";

type Props = {
  variant?: "info" | "success" | "warning" | "error";
  title?: string;
  children?: React.ReactNode;
};

const styles = {
  info: "bg-blue-50 text-blue-800 border-blue-200",
  success: "bg-green-50 text-green-800 border-green-200",
  warning: "bg-yellow-50 text-yellow-800 border-yellow-200",
  error: "bg-red-50 text-red-800 border-red-200",
} as const;

export default function Alert({ variant = "info", title, children }: Props) {
  return (
    <div className={`border rounded-md p-3 ${styles[variant]}`} role="alert">
      {title ? <div className="font-medium mb-1">{title}</div> : null}
      {children ? <div className="text-sm">{children}</div> : null}
    </div>
  );
}

