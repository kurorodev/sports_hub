import { tr } from "../i18n/translate";
import { useLocale } from "../i18n/use-preferences";
import type { ReactNode } from "react";

export function FormField({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  useLocale();
  return (
    <div className="form-field">
      <label htmlFor={id}>{tr(label)}</label>
      {children}
      {hint && (
        <p className="field-hint" id={`${id}-hint`}>
          {tr(hint)}
        </p>
      )}
      {error && (
        <p className="field-error" id={`${id}-error`}>
          {tr(error)}
        </p>
      )}
    </div>
  );
}
