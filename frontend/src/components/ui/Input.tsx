import React, { useState } from "react";

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  error?: string;
  label?: string;
  showPasswordToggle?: boolean;
};

export default function Input({ 
  label, 
  error, 
  className = "", 
  id, 
  type = "text",
  showPasswordToggle = false,
  ...props 
}: InputProps) {
  const [showPassword, setShowPassword] = useState(false);
  const inputId = id || (label ? `${label.replace(/\s+/g, "-").toLowerCase()}-input` : undefined);
  const isRequired = Boolean((props as any)?.required);
  
  const isPassword = type === "password";
  const shouldShowToggle = showPasswordToggle && isPassword;
  const inputType = shouldShowToggle && showPassword ? "text" : type;
  
  // Wrap onChange to trim leading/trailing spaces for non-password fields
  const originalOnChange = (props as any)?.onChange as (e: React.ChangeEvent<HTMLInputElement>) => void;
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isPassword) {
      const v = e.target.value;
      const trimmed = v.replace(/^\s+|\s+$/g, "");
      if (trimmed !== v) {
        // Create a shallow clone event with trimmed value
        const cloned = {
          ...e,
          target: { ...e.target, value: trimmed }
        } as React.ChangeEvent<HTMLInputElement>;
        originalOnChange && originalOnChange(cloned);
        return;
      }
    }
    originalOnChange && originalOnChange(e);
  };
  
  return (
    <div className="space-y-1">
      {label ? (
        <label htmlFor={inputId} className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          {label}
          {isRequired ? <span className="text-red-500 ml-0.5">*</span> : null}
        </label>
      ) : null}
      <div className="relative">
        <input
          id={inputId}
          type={inputType}
          className={`glass-input block w-full rounded-md px-3 py-2 text-gray-900 dark:text-slate-100 shadow-sm ${
            shouldShowToggle ? 'pr-10' : ''
          } ${className}`}
          {...props}
          onChange={handleChange}
        />
        {shouldShowToggle && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white"
            title={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            )}
          </button>
        )}
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}

