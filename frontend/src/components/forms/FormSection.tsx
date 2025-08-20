import React from "react";

type Props = {
  title?: string;
  description?: string;
  children: React.ReactNode;
};

export default function FormSection({ title, description, children }: Props) {
  return (
    <section>
      {(title || description) && (
        <div className="mb-2">
          {title ? <h4 className="text-sm font-semibold text-gray-900">{title}</h4> : null}
          {description ? <p className="text-xs text-gray-600">{description}</p> : null}
        </div>
      )}
      <div className="space-y-3">{children}</div>
    </section>
  );
}

