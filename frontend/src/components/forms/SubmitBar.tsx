import React from "react";
import Button from "../ui/Button";

type Props = {
  cancelText?: string;
  submitText?: string;
  onCancel?: () => void;
  loading?: boolean;
};

export default function SubmitBar({ cancelText = "Cancel", submitText = "Save", onCancel, loading }: Props) {
  return (
    <div className="flex items-center justify-end space-x-2">
      {onCancel ? (
        <Button type="button" variant="ghost" onClick={onCancel}>
          {cancelText}
        </Button>
      ) : null}
      <Button type="submit" disabled={loading}>
        {loading ? "Saving…" : submitText}
      </Button>
    </div>
  );
}

