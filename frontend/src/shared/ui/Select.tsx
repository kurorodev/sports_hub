import {
  useId,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentPropsWithRef,
} from "react";
import { SearchableSelect } from "./SearchableSelect";

type Option = { id: string; name: string; disabled: boolean };

export function Select({
  children,
  ref,
  id,
  value,
  defaultValue,
  disabled,
  required,
  onChange,
  onBlur,
  onFocus,
  className,
  style,
  ...props
}: Omit<ComponentPropsWithRef<"select">, "multiple" | "size">) {
  const generatedId = useId();
  const controlId = id ?? generatedId;
  const native = useRef<HTMLSelectElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [selected, setSelected] = useState(String(value ?? defaultValue ?? ""));
  const [options, setOptions] = useState<Option[]>([]);
  useImperativeHandle(ref, () => native.current!, []);

  // Preserve native form values, autofill and React Hook Form's register/reset contract.
  useLayoutEffect(() => {
    const element = native.current;
    if (!element) return;
    setSelected(element.value);
    const next = Array.from(element.options, (option) => ({
      id: option.value,
      name: option.label,
      disabled: option.disabled,
    }));
    setOptions((previous) =>
      previous.length === next.length &&
      previous.every(
        (option, index) =>
          option.id === next[index].id &&
          option.name === next[index].name &&
          option.disabled === next[index].disabled,
      )
        ? previous
        : next,
    );
  }, [children, value, defaultValue]);

  return (
    <span className="native-select" style={style}>
      <SearchableSelect
        ref={trigger}
        id={controlId}
        value={selected}
        options={options}
        disabled={disabled}
        searchable={options.length > 8}
        placeholder="Выберите вариант"
        searchLabel="Поиск по вариантам"
        searchPlaceholder="Найти вариант…"
        listLabel={props["aria-label"] ?? "Варианты выбора"}
        hint="Выберите вариант или начните вводить название"
        aria-label={props["aria-label"]}
        aria-labelledby={props["aria-labelledby"]}
        aria-invalid={props["aria-invalid"]}
        aria-describedby={props["aria-describedby"]}
        aria-required={required}
        onChange={(next) => {
          const element = native.current;
          if (!element) return;
          element.value = next;
          setSelected(next);
          element.dispatchEvent(new Event("change", { bubbles: true }));
        }}
        onBlur={() => {
          native.current?.dispatchEvent(
            new FocusEvent("focusout", { bubbles: true }),
          );
        }}
      />
      <select
        {...props}
        ref={native}
        id={`${controlId}-native`}
        className={`select-native-input ${className ?? ""}`}
        aria-hidden="true"
        tabIndex={-1}
        value={value}
        defaultValue={defaultValue}
        disabled={disabled}
        required={required}
        onChange={(event) => {
          setSelected(event.currentTarget.value);
          onChange?.(event);
        }}
        onBlur={onBlur}
        onFocus={(event) => {
          trigger.current?.focus();
          onFocus?.(event);
        }}
      >
        {children}
      </select>
    </span>
  );
}
