import React from "react";

type Column<T> = {
  key: keyof T | string;
  header: string;
  render?: (row: T) => React.ReactNode;
};

type Props<T> = {
  columns: Column<T>[];
  data: T[];
};

export default function ResourceTable<T extends Record<string, unknown>>({ columns, data }: Props<T>) {
  return (
    <div className="overflow-x-auto border rounded-md">
      <table className="min-w-full bg-white text-sm">
        <thead className="bg-gray-50 text-gray-700">
          <tr>
            {columns.map((c) => (
              <th key={String(c.key)} className="px-3 py-2 text-left font-medium">{c.header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, idx) => (
            <tr key={idx} className="border-t">
              {columns.map((c) => (
                <td key={String(c.key)} className="px-3 py-2">
                  {c.render ? c.render(row) : String(row[c.key as keyof typeof row] ?? "")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

