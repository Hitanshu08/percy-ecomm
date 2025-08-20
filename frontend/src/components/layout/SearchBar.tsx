import React from "react";

type Props = {
  placeholder?: string;
  onSearch?: (value: string) => void;
};

export default function SearchBar({ placeholder = "Search…", onSearch }: Props) {
  const [value, setValue] = React.useState("");
  return (
    <div className="relative w-full max-w-sm">
      <input
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && onSearch) onSearch(value);
        }}
        className="w-full rounded-md border border-gray-300 pl-10 pr-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500"
        placeholder={placeholder}
      />
      <span className="absolute left-3 top-2.5 text-gray-400">🔎</span>
    </div>
  );
}

