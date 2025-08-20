import React from "react";

type Props = {
  columns?: 1 | 2 | 3 | 4;
  children: React.ReactNode;
};

export default function FormRow({ columns = 2, children }: Props) {
  const grid = {
    1: "grid-cols-1",
    2: "grid-cols-1 sm:grid-cols-2",
    3: "grid-cols-1 sm:grid-cols-3",
    4: "grid-cols-1 sm:grid-cols-4",
  }[columns];
  return <div className={`grid gap-4 ${grid}`}>{children}</div>;
}

