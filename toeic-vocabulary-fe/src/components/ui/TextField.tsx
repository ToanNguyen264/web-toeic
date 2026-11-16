import type { InputHTMLAttributes, ReactNode } from "react";

type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
  leadingIcon?: ReactNode;
  trailingContent?: ReactNode;
  hint?: string;
};

export function TextField({
  label,
  error,
  leadingIcon,
  trailingContent,
  hint,
  id,
  className = "",
  ...props
}: TextFieldProps) {
  const fieldId = id || props.name;
  const descriptionId = error
    ? `${fieldId}-error`
    : hint
      ? `${fieldId}-hint`
      : undefined;

  return (
    <div>
      <label
        htmlFor={fieldId}
        className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200"
      >
        {label}
      </label>
      <div className="relative">
        {leadingIcon && (
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
            {leadingIcon}
          </span>
        )}
        <input
          {...props}
          id={fieldId}
          aria-invalid={Boolean(error)}
          aria-describedby={descriptionId}
          className={`w-full rounded-xl border bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:ring-4 dark:bg-slate-900 dark:text-white ${
            leadingIcon ? "pl-11" : ""
          } ${trailingContent ? "pr-12" : ""} ${
            error
              ? "border-rose-400 focus:border-rose-500 focus:ring-rose-500/10"
              : "border-slate-200 hover:border-slate-300 focus:border-indigo-500 focus:ring-indigo-500/10 dark:border-slate-700 dark:hover:border-slate-600"
          } ${className}`}
        />
        {trailingContent && (
          <span className="absolute right-2.5 top-1/2 -translate-y-1/2">
            {trailingContent}
          </span>
        )}
      </div>
      {error ? (
        <p id={descriptionId} className="mt-1.5 text-xs font-medium text-rose-600">
          {error}
        </p>
      ) : hint ? (
        <p id={descriptionId} className="mt-1.5 text-xs text-slate-500">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
