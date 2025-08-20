import React from "react";

type Props = React.FormHTMLAttributes<HTMLFormElement> & {
  children: React.ReactNode;
};

export default function Form({ children, className = "", ...props }: Props) {
  return (
    <form className={`space-y-4 ${className}`} {...props}>
      {children}
    </form>
  );
}

