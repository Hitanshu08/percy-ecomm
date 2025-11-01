import React from "react";

type CheckboxProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
};

export default function Checkbox({ label, className = "", ...props }: CheckboxProps) {
  return (
    <label className={`inline-flex items-center space-x-2 dark:text-gray-300 ${className}`}>
      <input type="checkbox" className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-600 dark:checked:bg-blue-600 dark:checked:border-blue-600" {...props} />
      {label ? <span className="text-sm text-gray-700 dark:text-gray-300">{label}</span> : null}
    </label>
  );
}

